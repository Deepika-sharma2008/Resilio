
const BASE_URL = 'http://localhost:5000/api/ingredients';

async function testIngredient() {
    try {
        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Tomato',
                category: 'Vegetables',
                unit: 'kg',
                minimumStock: 5
            })
        });

        const result = await response.json();
        console.log(result);
    } catch (error) {
        console.error('Request failed:', error.message);
    }
}

testIngredient();
