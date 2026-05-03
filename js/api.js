/**
 * API Client for Sovia Jewelry Repair App
 * Communicates with Google Apps Script Web App
 */

const CONFIG = {
    // URL WEB APP GAS AKTIF
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwaJsUPiuxnwVt2Rn_ALJrkUK8aaWwu7E5Z2F7cKkc8s5kuDCyiuif-PKs3dkUY1GJEvw/exec' 
};

class SoviaAPI {
    static async call(action, data = {}, pdfAction = '') {
        const payload = {
            action,
            data,
            pdfAction
        };

        try {
            // Using no-cors might be needed if there are issues, 
            // but for JSON response we need cors.
            // Note: Google Script redirect requires 'follow' redirect mode.
            const response = await fetch(CONFIG.SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Call Error:', error);
            throw error;
        }
    }

    static async getInitialData() {
        // We can use doGet for faster initial load
        try {
            const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getData`);
            return await response.json();
        } catch (error) {
            // Fallback to doPost if doGet fails
            return await this.call('getInitialData');
        }
    }

    static async processForm(formData) {
        return await this.call('processForm', formData);
    }

    static async updateRepairStatus(repairNumber, newStatus) {
        return await this.call('updateRepairStatus', { repairNumber, newStatus });
    }

    static async getAllRepairs() {
        return await this.call('getAllRepairs');
    }

    static async previewData(formData) {
        return await this.call('previewData', formData);
    }

    static async createPDF(formData, action) {
        return await this.call('createAndSendPDF', formData, action);
    }

    static async searchRepair(repairNumber) {
        return await this.call('searchRepair', { repairNumber });
    }

    static async uploadFile(base64, fileName) {
        return await this.call('uploadFile', { base64, fileName });
    }
}
