import json
import os
import psycopg2
import hashlib
import secrets
from datetime import datetime

def get_db_connection():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    return conn

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def generate_qr_token() -> str:
    return secrets.token_urlsafe(32)

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
            action = body.get('action')
            
            if action == 'register':
                phone = body.get('phone')
                password = body.get('password')
                role = body.get('role', 'client')
                name = body.get('name', '')
                
                if not phone or not password:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Телефон и пароль обязательны'}),
                        'isBase64Encoded': False
                    }
                
                password_hash = hash_password(password)
                qr_code = generate_qr_token() if role == 'courier' else None
                
                cursor.execute(
                    "INSERT INTO users (phone, password_hash, role, name, qr_code) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (phone, password_hash, role, name, qr_code)
                )
                user_id = cursor.fetchone()[0]
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'success': True,
                        'userId': user_id,
                        'role': role,
                        'qrCode': qr_code
                    }),
                    'isBase64Encoded': False
                }
            
            elif action == 'login':
                phone = body.get('phone')
                password = body.get('password')
                qr_code = body.get('qrCode')
                
                if qr_code:
                    cursor.execute(
                        "SELECT id, phone, role, name FROM users WHERE qr_code = %s",
                        (qr_code,)
                    )
                elif phone and password:
                    password_hash = hash_password(password)
                    cursor.execute(
                        "SELECT id, phone, role, name FROM users WHERE phone = %s AND password_hash = %s",
                        (phone, password_hash)
                    )
                else:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Необходим телефон и пароль или QR-код'}),
                        'isBase64Encoded': False
                    }
                
                user = cursor.fetchone()
                if not user:
                    return {
                        'statusCode': 401,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Неверные данные'}),
                        'isBase64Encoded': False
                    }
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'success': True,
                        'userId': user[0],
                        'phone': user[1],
                        'role': user[2],
                        'name': user[3]
                    }),
                    'isBase64Encoded': False
                }
        
        elif method == 'GET':
            params = event.get('queryStringParameters', {}) or {}
            user_id = params.get('userId')
            
            if user_id:
                cursor.execute(
                    "SELECT id, phone, role, name, qr_code FROM users WHERE id = %s",
                    (user_id,)
                )
                user = cursor.fetchone()
                
                if not user:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Пользователь не найден'}),
                        'isBase64Encoded': False
                    }
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'id': user[0],
                        'phone': user[1],
                        'role': user[2],
                        'name': user[3],
                        'qrCode': user[4]
                    }),
                    'isBase64Encoded': False
                }
            
            cursor.execute("SELECT id, phone, role, name, created_at FROM users ORDER BY created_at DESC")
            users = cursor.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'users': [{
                        'id': u[0],
                        'phone': u[1],
                        'role': u[2],
                        'name': u[3],
                        'createdAt': u[4].isoformat() if u[4] else None
                    } for u in users]
                }),
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
