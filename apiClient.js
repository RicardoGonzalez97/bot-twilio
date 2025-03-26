
   const axios = require('axios');
   const { userMessages, userId1 } = require('./chatgpt');
   
   async function getAppointments(accountID, calendarID) {
       if (!calendarID || !accountID) {
           throw new Error("getAccountById debe ejecutarse antes de getAppointments");
       }

       const url = `https://rest.gohighlevel.com/v1/appointments/?startDate=1735680000000&endDate=1767225599999&userId=${accountID}&calendarId=${calendarID}&teamId=${calendarID}&includeAll=true`;
       const method = 'GET';
       const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2NhdGlvbl9pZCI6IlZMU1ZhbXJiMTl3dkpMV1M5YVIzIiwidmVyc2lvbiI6MSwiaWF0IjoxNzM4NjkxMjE3MjI2LCJzdWIiOiI5SlZ1V0U3c2EyU1ZSeUV6amVOUCJ9.czvNcS4HAT0awWM5eUPnI4Ryc8u19Zq1u0JRqGKiXbg";
   
       try {
           const response = await axios({
               url,
               method,
               headers: {
                   'Authorization': `Bearer ${token}`,
                   'Content-Type': 'application/json',
               },
           });
           return response.data;
       } catch (error) {
           console.error('Error calling API:', error.message);
           if (error.response) {
               console.error('Response data:', error.response.data);
           }
           throw error;
       }
   }
   
   function formatAppointmentsForAI(appointmentsData) {
       try {
           if (!appointmentsData || !appointmentsData.appointments || !Array.isArray(appointmentsData.appointments)) {
               return "No hay citas disponibles.";
           }
   
           return appointmentsData.appointments.map((appointment, index) => {
               const startTime = appointment.start_time || appointment.startTime;
               const endTime = appointment.end_time || appointment.endTime;
               const title = appointment.title || "Sin título";
               const timezone = appointment.selected_timezone || "Zona horaria no especificada";
               
               const formattedStartTime = new Date(startTime).toLocaleString('es-MX', {
                   weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric'
               });
               const formattedEndTime = new Date(endTime).toLocaleString('es-MX', {
                   weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric'
               });
   
               return `Cita ${index + 1}: "${title}" inicia el ${formattedStartTime} y termina el ${formattedEndTime}. Espera a que el usuario te diga una fecha y hora y dile si tienes disponibilidad.`;
           }).join("\n");
       } catch (error) {
           console.error("Error al formatear las citas:", error.message);
           return "Error al formatear las citas.";
       }
   }
   
   async function getAccountById(user, accountData) {
       const url = `https://getaccountbyid-izwfjdu3fq-uc.a.run.app?id=${user}`;
       const method = 'GET';
       console.log("ENTROOOO A GET ACCOUNT")
       try {
           const response = await axios({
               url,
               method,
               headers: {
                   'Content-Type': 'application/json',
               },
           });
           console.log("RECIBIO DATOS", response.data);
          
           if (accountData.has(response.data.id)) {
            accountData.get(response.data.id).push({
                calendarID: response.data.calendarID,
                name: response.data.Name,
                accountID: response.data.accountID,
                locationID: response.data.locationID,
                contactID: response.data.contactID,
                userID: response.data.userID,
                calendarToken: response.data.calendarToken
            });
        } else {
            accountData.set(response.data.id, [{
                calendarID: response.data.calendarID,
                name: response.data.Name,
                accountID: response.data.accountID,
                locationID: response.data.locationID,
                contactID: response.data.contactID,
                userID: response.data.userID,
                calendarToken: response.data.calendarToken
            }]);
        }        
   
           console.log("Datos almacenados:", accountData);
       } catch (error) {
           console.error('Error calling API:', error.message);
           if (error.response) {
               console.error('Response data:', error.response.data);
           }
           throw error;
       }
   }

  
async function createAppointment(calendarId, locationId, contactId, startTime, endTime, title, assignedUserId, token) {
    const url = "https://services.leadconnectorhq.com/calendars/events/appointments";
    
    const requestBody = {
        "calendarId": calendarId,
        "locationId": locationId,
        "contactId": contactId,
        "startTime": startTime,
        "endTime": endTime,
        "title": title,
        "meetingLocationType": "default",
        "appointmentStatus": "confirmed",
        "assignedUserId": assignedUserId,
        "address": "Zoom",
        "ignoreFreeSlotValidation": true
    };

    try {
        const response = await axios.post(url, requestBody, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Version': '2021-04-15'
            }
        });

        console.log("✅ Cita creada con éxito:", response.data);
        return true; // Devuelve `true` si la cita se creó correctamente
    } catch (error) {
        console.error("❌ Error al crear la cita:", error.response ? error.response.data : error.message);
        return false; // Devuelve `false` si hubo un error
    }
}


   
module.exports = { getAccountById, getAppointments ,createAppointment};
   