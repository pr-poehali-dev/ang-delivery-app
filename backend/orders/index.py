import json
import os
import psycopg2
from datetime import datetime

def get_db_connection():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    return conn

def generate_order_number(cursor) -> str:
    cursor.execute("SELECT COUNT(*) FROM orders")
    count = cursor.fetchone()[0]
    return f"{count + 1:03d}"

def handler(event: dict, context) -> dict:
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if method == 'POST':
            body = json.loads(event.get('body', '{}'))
            order_type = body.get('type')
            client_id = body.get('clientId')
            from_address = body.get('fromAddress')
            to_address = body.get('toAddress')
            items = body.get('items')
            restaurant = body.get('restaurant')
            
            if not all([order_type, from_address, to_address, items]):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Все поля обязательны'}),
                    'isBase64Encoded': False
                }
            
            order_number = generate_order_number(cursor)
            
            cursor.execute(
                """INSERT INTO orders (order_number, type, client_id, from_address, to_address, items, restaurant, status)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending') RETURNING id""",
                (order_number, order_type, client_id, from_address, to_address, items, restaurant)
            )
            order_id = cursor.fetchone()[0]
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'orderId': order_id,
                    'orderNumber': order_number
                }),
                'isBase64Encoded': False
            }
        
        elif method == 'GET':
            params = event.get('queryStringParameters', {}) or {}
            status = params.get('status')
            client_id = params.get('clientId')
            courier_id = params.get('courierId')
            
            query = "SELECT id, order_number, type, client_id, courier_id, from_address, to_address, items, restaurant, status, rating, review, created_at FROM orders WHERE 1=1"
            query_params = []
            
            if status:
                query += " AND status = %s"
                query_params.append(status)
            
            if client_id:
                query += " AND client_id = %s"
                query_params.append(client_id)
            
            if courier_id:
                query += " AND courier_id = %s"
                query_params.append(courier_id)
            
            query += " ORDER BY created_at DESC"
            
            cursor.execute(query, query_params)
            orders = cursor.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'orders': [{
                        'id': o[0],
                        'orderNumber': o[1],
                        'type': o[2],
                        'clientId': o[3],
                        'courierId': o[4],
                        'fromAddress': o[5],
                        'toAddress': o[6],
                        'items': o[7],
                        'restaurant': o[8],
                        'status': o[9],
                        'rating': o[10],
                        'review': o[11],
                        'createdAt': o[12].isoformat() if o[12] else None
                    } for o in orders]
                }),
                'isBase64Encoded': False
            }
        
        elif method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            order_id = body.get('orderId')
            action = body.get('action')
            
            if action == 'accept':
                courier_id = body.get('courierId')
                cursor.execute(
                    "UPDATE orders SET courier_id = %s, status = 'accepted', updated_at = %s WHERE id = %s",
                    (courier_id, datetime.now(), order_id)
                )
            
            elif action == 'updateStatus':
                new_status = body.get('status')
                cursor.execute(
                    "UPDATE orders SET status = %s, updated_at = %s WHERE id = %s",
                    (new_status, datetime.now(), order_id)
                )
            
            elif action == 'rate':
                rating = body.get('rating')
                review = body.get('review', '')
                cursor.execute(
                    "UPDATE orders SET rating = %s, review = %s, updated_at = %s WHERE id = %s",
                    (rating, review, datetime.now(), order_id)
                )
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Метод не поддерживается'}),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
