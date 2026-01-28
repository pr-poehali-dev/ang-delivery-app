import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';

const API_AUTH = 'https://functions.poehali.dev/5aa77749-ddb9-4714-a83a-a81f4b9a356d';
const API_ORDERS = 'https://functions.poehali.dev/b1fbfa6c-1656-4b7a-89a8-66ecdb11621c';

type UserRole = 'client' | 'courier' | 'admin';

interface User {
  id: number;
  phone: string;
  role: UserRole;
  name?: string;
  qrCode?: string;
}

interface Order {
  id: number;
  orderNumber: string;
  type: 'delivery' | 'food';
  clientId?: number;
  courierId?: number;
  fromAddress: string;
  toAddress: string;
  items: string;
  status: 'pending' | 'accepted' | 'delivering' | 'completed';
  rating?: number;
  review?: string;
  restaurant?: string;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authData, setAuthData] = useState({ phone: '', password: '', name: '', role: 'client' as UserRole });
  const [showQRAuth, setShowQRAuth] = useState(false);
  const [qrInput, setQrInput] = useState('');
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrder, setNewOrder] = useState({
    type: 'delivery' as 'delivery' | 'food',
    fromAddress: '',
    toAddress: '',
    items: '',
    restaurant: '',
  });

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserData, setNewUserData] = useState({ phone: '', password: '', name: '', role: 'courier' as UserRole });
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQrCodeData] = useState('');

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    try {
      let url = API_ORDERS;
      const params = new URLSearchParams();
      
      if (user?.role === 'client') {
        params.append('clientId', user.id.toString());
      } else if (user?.role === 'courier') {
        params.append('courierId', user.id.toString());
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.orders) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Ошибка загрузки заказов:', error);
    }
  };

  const handleAuth = async () => {
    try {
      const response = await fetch(API_AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authMode === 'login' ? 'login' : 'register',
          phone: authData.phone,
          password: authData.password,
          role: authData.role,
          name: authData.name,
        }),
      });

      const data = await response.json();

      if (data.success || data.userId) {
        setUser({
          id: data.userId,
          phone: data.phone || authData.phone,
          role: data.role,
          name: data.name || authData.name,
          qrCode: data.qrCode,
        });
        setShowAuth(false);
        toast.success(authMode === 'login' ? 'Вход выполнен!' : 'Регистрация успешна!');
      } else {
        toast.error(data.error || 'Ошибка авторизации');
      }
    } catch (error) {
      toast.error('Ошибка подключения');
    }
  };

  const handleQRAuth = async () => {
    try {
      const response = await fetch(API_AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          qrCode: qrInput,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setUser({
          id: data.userId,
          phone: data.phone,
          role: data.role,
          name: data.name,
        });
        setShowAuth(false);
        setShowQRAuth(false);
        toast.success('Вход по QR выполнен!');
      } else {
        toast.error(data.error || 'Неверный QR-код');
      }
    } catch (error) {
      toast.error('Ошибка подключения');
    }
  };

  const handleCreateOrder = async () => {
    if (!newOrder.fromAddress || !newOrder.toAddress || !newOrder.items) {
      toast.error('Заполните все поля');
      return;
    }

    try {
      const response = await fetch(API_ORDERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newOrder.type,
          clientId: user?.id,
          fromAddress: newOrder.fromAddress,
          toAddress: newOrder.toAddress,
          items: newOrder.items,
          restaurant: newOrder.type === 'food' ? newOrder.restaurant : null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Заказ создан!');
        setNewOrder({ type: 'delivery', fromAddress: '', toAddress: '', items: '', restaurant: '' });
        loadOrders();
      }
    } catch (error) {
      toast.error('Ошибка создания заказа');
    }
  };

  const handleAcceptOrder = async (orderId: number) => {
    try {
      await fetch(API_ORDERS, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          orderId,
          courierId: user?.id,
        }),
      });

      toast.success('Заказ принят!');
      loadOrders();
    } catch (error) {
      toast.error('Ошибка принятия заказа');
    }
  };

  const handleUpdateStatus = async (orderId: number, status: string) => {
    try {
      await fetch(API_ORDERS, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateStatus',
          orderId,
          status,
        }),
      });

      toast.success('Статус обновлён!');
      loadOrders();
    } catch (error) {
      toast.error('Ошибка обновления статуса');
    }
  };

  const handleRateOrder = async (orderId: number, rating: number) => {
    try {
      await fetch(API_ORDERS, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rate',
          orderId,
          rating,
        }),
      });

      toast.success(`Оценка ${rating} ⭐ поставлена!`);
      loadOrders();
    } catch (error) {
      toast.error('Ошибка оценки');
    }
  };

  const handleCreateUser = async () => {
    try {
      const response = await fetch(API_AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          phone: newUserData.phone,
          password: newUserData.password,
          role: newUserData.role,
          name: newUserData.name,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Пользователь создан!');
        if (data.qrCode) {
          setQrCodeData(data.qrCode);
          setShowQRCode(true);
        }
        setShowCreateUser(false);
        setNewUserData({ phone: '', password: '', name: '', role: 'courier' });
      } else {
        toast.error(data.error || 'Ошибка создания пользователя');
      }
    } catch (error) {
      toast.error('Ошибка создания пользователя');
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-300';
      case 'accepted': return 'bg-blue-500/20 text-blue-300';
      case 'delivering': return 'bg-purple-500/20 text-purple-300';
      case 'completed': return 'bg-green-500/20 text-green-300';
    }
  };

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'Ожидает';
      case 'accepted': return 'Принят';
      case 'delivering': return 'В пути';
      case 'completed': return 'Завершён';
    }
  };

  if (showAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 gradient-card border-primary/20">
          <div className="text-center mb-6">
            <div className="inline-block mb-4 gradient-primary text-transparent bg-clip-text">
              <h1 className="text-4xl font-bold">Анг.Доставка</h1>
            </div>
            <p className="text-muted-foreground">Быстрая доставка товаров и еды</p>
          </div>

          {!showQRAuth ? (
            <>
              <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'login' | 'register')}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="login">Вход</TabsTrigger>
                  <TabsTrigger value="register">Регистрация</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-4">
                <Input
                  placeholder="Телефон"
                  value={authData.phone}
                  onChange={(e) => setAuthData({ ...authData, phone: e.target.value })}
                  className="bg-background/50"
                />
                <Input
                  type="password"
                  placeholder="Пароль"
                  value={authData.password}
                  onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                  className="bg-background/50"
                />

                {authMode === 'register' && (
                  <>
                    <Input
                      placeholder="Имя"
                      value={authData.name}
                      onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                      className="bg-background/50"
                    />
                    <select
                      value={authData.role}
                      onChange={(e) => setAuthData({ ...authData, role: e.target.value as UserRole })}
                      className="w-full p-2 rounded-md bg-background/50 border border-input"
                    >
                      <option value="client">Клиент</option>
                      <option value="courier">Курьер</option>
                    </select>
                  </>
                )}

                <Button onClick={handleAuth} className="w-full gradient-primary border-0" size="lg">
                  {authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
                </Button>

                <Button
                  onClick={() => setShowQRAuth(true)}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <Icon name="QrCode" className="mr-2" size={20} />
                  Войти по QR-коду
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">Введите код из QR</p>
              <Input
                placeholder="QR-код"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                className="bg-background/50"
              />
              <Button onClick={handleQRAuth} className="w-full gradient-primary border-0" size="lg">
                Войти
              </Button>
              <Button onClick={() => setShowQRAuth(false)} variant="outline" className="w-full">
                Назад
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <div className="inline-block gradient-primary text-transparent bg-clip-text">
              <h1 className="text-4xl font-bold">Анг.Доставка</h1>
            </div>
            <p className="text-muted-foreground">Добро пожаловать, {user?.name || user?.phone}!</p>
          </div>
          <Button variant="outline" onClick={() => { setUser(null); setShowAuth(true); }}>
            Выйти
          </Button>
        </div>

        {user?.role === 'client' && (
          <div className="space-y-6">
            <Tabs defaultValue="delivery" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="delivery" onClick={() => setNewOrder({ ...newOrder, type: 'delivery' })}>
                  <Icon name="Package" className="mr-2" size={18} />
                  Доставка товаров
                </TabsTrigger>
                <TabsTrigger value="food" onClick={() => setNewOrder({ ...newOrder, type: 'food' })}>
                  <Icon name="UtensilsCrossed" className="mr-2" size={18} />
                  Заказ еды
                </TabsTrigger>
              </TabsList>

              <TabsContent value="delivery">
                <Card className="p-6 gradient-card border-primary/20">
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <Icon name="Package" className="mr-2" size={24} />
                    Новый заказ доставки
                  </h3>
                  <div className="space-y-4">
                    <Input
                      placeholder="Откуда забрать"
                      value={newOrder.fromAddress}
                      onChange={(e) => setNewOrder({ ...newOrder, fromAddress: e.target.value })}
                      className="bg-background/50"
                    />
                    <Input
                      placeholder="Куда доставить"
                      value={newOrder.toAddress}
                      onChange={(e) => setNewOrder({ ...newOrder, toAddress: e.target.value })}
                      className="bg-background/50"
                    />
                    <Textarea
                      placeholder="Что доставить"
                      value={newOrder.items}
                      onChange={(e) => setNewOrder({ ...newOrder, items: e.target.value })}
                      className="bg-background/50"
                    />
                    <Button onClick={handleCreateOrder} className="w-full gradient-primary border-0" size="lg">
                      <Icon name="Send" className="mr-2" size={20} />
                      Создать заказ
                    </Button>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="food">
                <Card className="p-6 gradient-card border-secondary/20">
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <Icon name="UtensilsCrossed" className="mr-2" size={24} />
                    Новый заказ еды
                  </h3>
                  <div className="space-y-4">
                    <Input
                      placeholder="Ресторан"
                      value={newOrder.restaurant}
                      onChange={(e) => setNewOrder({ ...newOrder, restaurant: e.target.value })}
                      className="bg-background/50"
                    />
                    <Input
                      placeholder="Адрес доставки"
                      value={newOrder.toAddress}
                      onChange={(e) => setNewOrder({ ...newOrder, toAddress: e.target.value })}
                      className="bg-background/50"
                    />
                    <Textarea
                      placeholder="Состав заказа"
                      value={newOrder.items}
                      onChange={(e) => setNewOrder({ ...newOrder, items: e.target.value })}
                      className="bg-background/50"
                    />
                    <Button onClick={handleCreateOrder} className="w-full gradient-primary border-0" size="lg">
                      <Icon name="Send" className="mr-2" size={20} />
                      Оформить заказ
                    </Button>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Мои заказы</h3>
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id} className="p-6 hover-scale gradient-card border-primary/20">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 gradient-primary">
                          <AvatarFallback className="bg-transparent text-white">
                            {order.type === 'delivery' ? '📦' : '🍕'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-lg">Заказ #{order.orderNumber}</h4>
                          <Badge className={getStatusColor(order.status)}>{getStatusText(order.status)}</Badge>
                        </div>
                      </div>
                      {order.status === 'completed' && !order.rating && (
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => handleRateOrder(order.id, star)}
                              className="hover:scale-110 transition-transform"
                            >
                              ⭐
                            </button>
                          ))}
                        </div>
                      )}
                      {order.rating && (
                        <div className="text-yellow-400 font-semibold">
                          {'⭐'.repeat(order.rating)}
                        </div>
                      )}
                    </div>
                    {order.restaurant && (
                      <p className="text-sm text-muted-foreground mb-2">
                        <Icon name="Store" className="inline mr-1" size={14} />
                        {order.restaurant}
                      </p>
                    )}
                    <div className="space-y-2 text-sm">
                      <p className="flex items-center gap-2">
                        <Icon name="MapPin" size={16} className="text-primary" />
                        <span className="text-muted-foreground">Откуда:</span>
                        <span className="font-medium">{order.fromAddress}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Icon name="MapPinned" size={16} className="text-secondary" />
                        <span className="text-muted-foreground">Куда:</span>
                        <span className="font-medium">{order.toAddress}</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <Icon name="FileText" size={16} className="text-accent mt-1" />
                        <span className="text-muted-foreground">Состав:</span>
                        <span className="font-medium">{order.items}</span>
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {user?.role === 'courier' && (
          <div className="space-y-6">
            <Card className="p-6 gradient-card border-primary/20">
              <h3 className="text-2xl font-semibold mb-4 flex items-center">
                <Icon name="Bike" className="mr-3" size={28} />
                Доступные заказы
              </h3>
              <div className="space-y-4">
                {orders.filter(o => o.status === 'pending').map((order) => (
                  <Card key={order.id} className="p-5 bg-background/50 border-accent/20">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar className="h-10 w-10 gradient-primary">
                            <AvatarFallback className="bg-transparent text-white">
                              {order.type === 'delivery' ? '📦' : '🍕'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold">Заказ #{order.orderNumber}</h4>
                            <p className="text-xs text-muted-foreground">
                              {order.type === 'delivery' ? 'Доставка товаров' : 'Заказ еды'}
                            </p>
                          </div>
                        </div>
                        {order.restaurant && (
                          <p className="text-sm mb-2">
                            <Icon name="Store" className="inline mr-1" size={14} />
                            {order.restaurant}
                          </p>
                        )}
                        <div className="space-y-1 text-sm">
                          <p className="flex items-center gap-2">
                            <Icon name="MapPin" size={14} className="text-primary" />
                            {order.fromAddress}
                          </p>
                          <p className="flex items-center gap-2">
                            <Icon name="MapPinned" size={14} className="text-secondary" />
                            {order.toAddress}
                          </p>
                        </div>
                      </div>
                      <Button onClick={() => handleAcceptOrder(order.id)} className="gradient-primary border-0">
                        <Icon name="Check" className="mr-2" size={18} />
                        Принять
                      </Button>
                    </div>
                  </Card>
                ))}
                {orders.filter(o => o.status === 'pending').length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Нет доступных заказов</p>
                )}
              </div>
            </Card>

            <Card className="p-6 gradient-card border-secondary/20">
              <h3 className="text-2xl font-semibold mb-4 flex items-center">
                <Icon name="Clock" className="mr-3" size={28} />
                Мои активные заказы
              </h3>
              <div className="space-y-4">
                {orders.filter(o => o.courierId === user.id && (o.status === 'accepted' || o.status === 'delivering')).map((order) => (
                  <Card key={order.id} className="p-5 bg-background/50 border-primary/20">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-10 w-10 gradient-primary">
                        <AvatarFallback className="bg-transparent text-white">
                          {order.type === 'delivery' ? '📦' : '🍕'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-semibold">Заказ #{order.orderNumber}</h4>
                        <Badge className={getStatusColor(order.status)}>{getStatusText(order.status)}</Badge>
                      </div>
                    </div>
                    {order.restaurant && (
                      <p className="text-sm mb-2">
                        <Icon name="Store" className="inline mr-1" size={14} />
                        {order.restaurant}
                      </p>
                    )}
                    <div className="space-y-1 text-sm mb-3">
                      <p className="flex items-center gap-2">
                        <Icon name="MapPin" size={14} className="text-primary" />
                        {order.fromAddress}
                      </p>
                      <p className="flex items-center gap-2">
                        <Icon name="MapPinned" size={14} className="text-secondary" />
                        {order.toAddress}
                      </p>
                      <p className="text-muted-foreground">
                        <Icon name="FileText" size={14} className="inline mr-1" />
                        {order.items}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {order.status === 'accepted' && (
                        <Button onClick={() => handleUpdateStatus(order.id, 'delivering')} className="flex-1 gradient-primary border-0">
                          <Icon name="Truck" className="mr-2" size={18} />
                          В пути
                        </Button>
                      )}
                      {order.status === 'delivering' && (
                        <Button onClick={() => handleUpdateStatus(order.id, 'completed')} className="flex-1 gradient-primary border-0">
                          <Icon name="CheckCircle" className="mr-2" size={18} />
                          Завершить
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
                {orders.filter(o => o.courierId === user.id && (o.status === 'accepted' || o.status === 'delivering')).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Нет активных заказов</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {user?.role === 'admin' && (
          <div className="space-y-6">
            <Card className="p-6 gradient-card border-accent/20">
              <h3 className="text-2xl font-semibold mb-4 flex items-center">
                <Icon name="Shield" className="mr-3" size={28} />
                Панель администратора
              </h3>
              
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <Card className="p-4 bg-background/50 border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Всего заказов</p>
                      <p className="text-3xl font-bold gradient-primary text-transparent bg-clip-text">{orders.length}</p>
                    </div>
                    <Icon name="Package" size={40} className="text-primary/50" />
                  </div>
                </Card>
                <Card className="p-4 bg-background/50 border-secondary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Активных</p>
                      <p className="text-3xl font-bold gradient-primary text-transparent bg-clip-text">
                        {orders.filter(o => o.status === 'pending' || o.status === 'accepted').length}
                      </p>
                    </div>
                    <Icon name="Clock" size={40} className="text-secondary/50" />
                  </div>
                </Card>
                <Card className="p-4 bg-background/50 border-accent/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Завершённых</p>
                      <p className="text-3xl font-bold gradient-primary text-transparent bg-clip-text">
                        {orders.filter(o => o.status === 'completed').length}
                      </p>
                    </div>
                    <Icon name="CheckCircle" size={40} className="text-accent/50" />
                  </div>
                </Card>
              </div>

              <div className="space-y-3">
                <Button onClick={() => setShowCreateUser(true)} className="w-full gradient-primary border-0" size="lg">
                  <Icon name="UserPlus" className="mr-2" size={20} />
                  Создать пользователя
                </Button>
              </div>
            </Card>

            <Card className="p-6 gradient-card border-primary/20">
              <h3 className="text-xl font-semibold mb-4">Все заказы</h3>
              <div className="space-y-3">
                {orders.map((order) => (
                  <Card key={order.id} className="p-4 bg-background/50 border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 gradient-primary">
                          <AvatarFallback className="bg-transparent text-white">
                            {order.type === 'delivery' ? '📦' : '🍕'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold">Заказ #{order.orderNumber}</h4>
                          <p className="text-xs text-muted-foreground">
                            {order.fromAddress} → {order.toAddress}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(order.status)}>{getStatusText(order.status)}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </div>
        )}

        <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать нового пользователя</DialogTitle>
              <DialogDescription>Создайте курьера или клиента</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Телефон"
                value={newUserData.phone}
                onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
              />
              <Input
                type="password"
                placeholder="Пароль"
                value={newUserData.password}
                onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
              />
              <Input
                placeholder="Имя"
                value={newUserData.name}
                onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
              />
              <select
                value={newUserData.role}
                onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as UserRole })}
                className="w-full p-2 rounded-md bg-background border border-input"
              >
                <option value="client">Клиент</option>
                <option value="courier">Курьер</option>
              </select>
              <Button onClick={handleCreateUser} className="w-full gradient-primary border-0">
                Создать
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>QR-код для курьера</DialogTitle>
              <DialogDescription>Распечатайте этот QR-код для быстрого входа</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-4">
              <QRCode value={qrCodeData} size={256} />
            </div>
            <p className="text-center text-sm text-muted-foreground">Код: {qrCodeData}</p>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Index;
