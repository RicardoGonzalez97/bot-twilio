require("dotenv").config();
const { createBot, createProvider, createFlow, addKeyword } = require('@bot-whatsapp/bot')
const TwilioProvider = require('@bot-whatsapp/provider/twilio')
const MockAdapter = require('@bot-whatsapp/database/mock')
var { chat,userMessages,setUserId,sendSystemMessage } = require("./chatgpt");
const { getAccountById, getAppointments,createAppointment } = require("./apiClient");
const chrono = require("chrono-node");
const es = require('chrono-node/es');

let accountData = new Map();  
const userFlags = new Map();
var hostingID = ""

var fechaDt = Date()
function extraerFecha(mensaje) {
    console.log("Entro a extraer la fecha", mensaje);
    const parsed = chrono.parse(mensaje, new Date(), { forwardDate: true });

    if (parsed.length === 0) {
        console.log("❌ No se detectó fecha");
        return null;
    }
    let fechaDetectada = parsed[0].start.date();
    let ahora = new Date();

    console.log("🔍 Análisis de chrono-node:", parsed[0]);
    if (!parsed[0].start.knownValues.year) {
        let mesDetectado = fechaDetectada.getMonth();
        let diaDetectado = fechaDetectada.getDate();

        if (mesDetectado < ahora.getMonth() || (mesDetectado === ahora.getMonth() && diaDetectado < ahora.getDate())) {
            fechaDetectada.setFullYear(ahora.getFullYear());//+1);
        } else {
            fechaDetectada.setFullYear(ahora.getFullYear());
        }
    }
    if (parsed[0].start.knownValues.hour !== undefined) {
        fechaDetectada.setHours(parsed[0].start.knownValues.hour);
        fechaDetectada.setMinutes(parsed[0].start.knownValues.minute || 0);
        fechaDetectada.setSeconds(parsed[0].start.knownValues.second || 0);
    }

    console.log("📅 Fecha detectada corregida con hora:", fechaDetectada.toISOString());
    return fechaDetectada;
}

 
async function verificarDisponibilidad(fechaDt) {
    if (!fechaDt) return null;  
    let account = accountData.get(hostingID);
    let accountInfo = account[0];
    console.log("EL ACCOUNT TIENE",accountInfo)

    const citasOcupadas = await getAppointments(accountInfo.accountID,accountInfo.calendarID)
    console.log("Las citas ocupadas son:", citasOcupadas.appointments);  
    const fechaComparar = new Date(fechaDt);
    for (const cita of citasOcupadas.appointments) {
        const inicio = new Date(cita.start_time);
        const fin = new Date(cita.end_time);
        if (fechaComparar >= inicio && fechaComparar < fin) {
            return false;
        }
    }

    return true;
}


async function manejarMensaje(ctx, ctxFn) {
    console.log("✉️ Mensaje recibido:", ctx.body, "El mensaje viene de ",ctx.from);
    const userId = ctx.from;
    setUserId(userId)

    if (!userFlags.has(userId)) {
        userFlags.set(userId, { flagAvailable: false, flagConfirm: false });
    }

    const flagConfirm = getUserFlag(userId, "flagConfirm");

    if (flagConfirm) {
    console.log("✉️ Probando post")
    const accountInfo = accountData.get(hostingID);
    console.log(accountInfo);
        let calendarId = accountInfo[0].calendarID
        let locationId = accountInfo[0].locationID
        let contactId = accountInfo[0].contactID
        let assignedUserId = accountInfo[0].userID
        let token = accountInfo[0].calendarToken
        let startTime = fechaDt
        let endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1); 

        console.log("-------Start y End-------");
        console.log("📅 startTime:", startTime, " | Tipo:", typeof startTime);
        console.log("📅 endTime:", endTime, " | Tipo:", typeof endTime);

        const success = await createAppointment(calendarId, locationId, contactId, startTime, endTime,`Cita con ${ctx.body} al número  ${userId}`, assignedUserId, token)
        if (success) {
            sendSystemMessage("El agendamiento fue exitoso, devuelve un mensaje de que la cita ha sido agendada exitosamente, y que tenga buen dia de forma amable y formal. Igualmente reinicia el flujo de conversacion por si otro usuario necesita otra cita o consulta.");
            console.log("✉️ excelente")
        }
        else {
            sendSystemMessage("El agendamiento falló, devuelve un mensaje de que lamentablemente ocurrió un error, que vuelva a intentar mas tarde y reinicia el flujo por si requiere algo más el usuario.");
            console.log("✉️ fallo")
        }
        userFlags.set(userId, { flagAvailable: false, flagConfirm: false });
    }

    const answer = await chat(ctx.body);
    const chatgptAns = answer.content.toUpperCase();
    const answerUser = ctx.body.toUpperCase();
    const answerClean = answer.content.replace(/\(OPENAI.*\)/, '').trim();
    let regex = /openai(.*)/i; 
    let result = answer.content.match(regex);
    let extractedContent = result ? result[1].trim() : '';
    console.log("\nCHATGPT RESPONDE",answer.content)
    console.log("\nUSUARIO RESPONDE",ctx.body)
    console.log("\n\n\nCONDICIONES: INCLUYE OPENAI?",answer.content.includes("OPENAI"), ". \n\nIncluye si? ",ctx.body == "Si")
    if (chatgptAns.includes("OPENAI") && (!answerUser.includes("SI") || !answerUser.includes("SÍ") )) {
        fechaDt = extraerFecha(extractedContent);
        if (fechaDt) {
            const disponible = await verificarDisponibilidad(fechaDt);
            const respuesta = disponible ? `✅ La fecha ${fechaDt.toLocaleString()} está disponible. ¿Quieres agendarla? Responde SI o NO`
            : `❌ Lo siento, la fecha ${fechaDt.toLocaleString()} ya está ocupada. Elige otra hora.`;  
            if (disponible) {
                console.log("-----MANDAMOS MENSAJE A SISTEMA------")
                userFlags.set(userId, { flagAvailable: true, flagConfirm: false });
                sendSystemMessage("Ahora sabemos que esta disponible, manda un mensaje al usuario que si quiere agendarla, si dice que si, PIDE SU NOMBRE PARA AGENDAR, si dice que no, vuelve a preguntar en que fecha y hora quiere");
            }
            else {
                console.log("------MANDAMOS MENSAJE A SISTEMA------")
                userFlags.set(userId, { flagAvailable: false, flagConfirm: false });
                sendSystemMessage("Ahora sabemos que NO esta disponible, manda un mensaje al usuario que le explique que no esta disponible esa fecha, que por favor te indique otra. TIENES QUE VOLVER A HACER TODO EL FLUJO de los 7 pasos que te di al principio.");
       
            }
        return await ctxFn.flowDynamic(respuesta);
        }
    } else {
        const flagAvaila = getUserFlag(userId, "flagAvailable");

        if (answerUser.includes("NO") && flagAvaila) {
            console.log("------NO ACEPTO------")
            sendSystemMessage("El usuario no acepto la confirmacion, vuelve a preguntar para que fecha requiere la cita.");
            userFlags.set(userId, { flagAvailable: false, flagConfirm: false });
        }
        else  if ((answerUser.includes("SI") || answerUser.includes("SÍ") ) && flagAvaila){
            console.log("------SI ACEPTO------")
            sendSystemMessage("El usuario acepto la confirmacion, pregunta su nombre para poder agendar la cita a su nombre.");
            userFlags.set(userId, { flagAvailable: true, flagConfirm: true });
        }

        return await ctxFn.flowDynamic(answerClean);
     }
}

const flowBienvenido = addKeyword(["Hola","Buenas","Buenos","Buen","Bonito"]).addAnswer(
    "Hola, que tal. Dime en qué puedo ayudarte hoy.",
    { capture: true },
    manejarMensaje
);

const flowSi = addKeyword(["Si"]).addAnswer(
    "Excelente, cita agendada! Hasta luego",
    { capture: true },
 
);

async function obtenerMiNumero(provider) {
    setTimeout(async () => {
        try {
            //const client = await provider.getInstance();
            hostingID ="5219611292843"
            //console.log("🤖 Mi número de WhatsApp es:", client.user.id.split(":")[0]);
            await getAccountById(hostingID, accountData);  
            console.log("OBTUVO DATOS ",accountData)
        } catch (error) {
            console.error("❌ Error obteniendo el número:", error);
        }
    }, 5000); // Espera 5 segundos antes de ejecutarse
}

function setUserFlag(userId, flag) {
    userFlags.set(userId, flag);
}

 
function getUserFlag(userId, flagName) {
    return userFlags.has(userId) ? userFlags.get(userId)[flagName] : false;
}



const flowConsultas = addKeyword([""]).addAction({ capture: true }, manejarMensaje);
 
const main = async () => {
    const adapterDB = new MockAdapter()
    const adapterFlow = createFlow([flowBienvenido,flowConsultas]);

   
    const adapterProvider = createProvider(TwilioProvider, {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        vendorNumber: process.env.TWILIO_PHONE,
    })

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })
    obtenerMiNumero(adapterProvider);
}

main()
