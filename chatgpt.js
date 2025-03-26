const { OpenAI } = require("openai"); // Esta es la forma correcta de importar la librería
require("dotenv").config();  // Cargar variables de entorno
const path = require("path");
const fs = require("fs");

const MAX_MESSAGES = 10;

const userMessages = new Map();
var userId1 = "User1";

const pathConsultas = path.join(__dirname, "mensajes", "promptconsultas.txt");
const promptConsultas = fs.readFileSync(pathConsultas, "utf8");

const setUserId = (newUserId) => {
    console.log(`🔄 Cambiando userId1 de "${userId1}" a "${newUserId}"`);
    userId1 = newUserId;
    if (!userMessages.has(userId1)) {
        userMessages.set(userId1, [
            { role: "system", content: promptConsultas },
        ]);
    }
};

const sendSystemMessage = (message) => {
    if (!userMessages.has(userId1)) {
        console.warn("No se ha encontrado un mensaje para este usuario. Inicializando...");
        userMessages.set(userId1, []);
    }
    userMessages.get(userId1).push({ role: "system", content: message });
    console.log("Mensaje del sistema enviado:", message);
};

const chat = async (text, retries = 3, delay = 1000) => {
    userMessages.get(userId1).push({ role: "user", content: text });
    console.log("El usuario es", userId1);

    try {
        // Usar la configuración y la API correcta según la nueva librería
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,  // Asume que la clave de API está en .env
        });

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: userMessages.get(userId1),
        });

        userMessages.get(userId1).push({ role: "assistant", content: completion.choices[0].message.content });
        return completion.choices[0].message;
    } catch (err) {
        if (err.response && err.response.status === 429 && retries > 0) {
            console.warn(`Límite de solicitudes alcanzado. Reintentando en ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return chat(text, retries - 1, delay * 2);
        }
        console.error("Error al conectar con OpenAI:", err);
        return "ERROR";
    }
};

module.exports = {
    chat,
    userMessages,
    setUserId,
    sendSystemMessage,
};
