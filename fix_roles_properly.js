const mongoose = require('mongoose');
const bcrypt = require('bcrypt-nodejs');

// Подключение к MongoDB
mongoose.connect('mongodb://localhost:27017/adapt-authoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Схема пользователя
const userSchema = new mongoose.Schema({
  idNumber: String,
  firstName: String,
  lastName: String,
  email: { type: String, required: true, unique: true },
  auth: String,
  password: String,
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'role' }],
  firstAccess: Date,
  lastAccess: Date,
  failedLoginCount: { type: Number, default: 0 },
  metadata: Object,
  tenantID: { type: mongoose.Schema.Types.ObjectId, ref: 'tenant' },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('user', userSchema);

// Схема роли
const roleSchema = new mongoose.Schema({
  name: String,
  permissions: [String],
  tenantID: { type: mongoose.Schema.Types.ObjectId, ref: 'tenant' },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Role = mongoose.model('role', roleSchema);

// Схема арендатора
const tenantSchema = new mongoose.Schema({
  name: String,
  isEnabled: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Tenant = mongoose.model('tenant', tenantSchema);

async function fixRolesProperly() {
  try {
    console.log('Начинаем правильное исправление ролей...');
    
    // Очистить все существующие роли и пользователей
    await Role.deleteMany({});
    await User.deleteMany({});
    console.log('Очищены существующие роли и пользователи');
    
    // Создать арендатора по умолчанию
    let tenant = await Tenant.findOne({ name: 'default' });
    if (!tenant) {
      tenant = new Tenant({
        name: 'default',
        isEnabled: true
      });
      await tenant.save();
      console.log('Создан арендатор по умолчанию');
    } else {
      console.log('Найден существующий арендатор');
    }

    // Создать все необходимые роли с правильными разрешениями
    const roles = [
      {
        name: 'Authenticated User',
        permissions: ['course:read', 'course:create', 'course:edit', 'course:delete'],
        tenantID: tenant._id
      },
      {
        name: 'Course Creator', 
        permissions: ['course:read', 'course:create', 'course:edit', 'course:delete', 'user:read'],
        tenantID: tenant._id
      },
      {
        name: 'Super Admin',
        permissions: ['*'], // Все разрешения
        tenantID: tenant._id
      }
    ];

    const createdRoles = [];
    for (const roleData of roles) {
      const role = new Role(roleData);
      await role.save();
      createdRoles.push(role);
      console.log(`Создана роль: ${role.name} (ID: ${role._id})`);
    }

    // Хешировать пароль
    const hashedPassword = bcrypt.hashSync('admin123', bcrypt.genSaltSync(10));

    // Создать пользователя-администратора
    const superAdminRole = createdRoles.find(r => r.name === 'Super Admin');
    const admin = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: hashedPassword,
      roles: [superAdminRole._id],
      tenantID: tenant._id,
      firstAccess: new Date(),
      lastAccess: new Date(),
      failedLoginCount: 0
    });

    await admin.save();
    console.log('Администратор создан успешно!');
    console.log('Email: admin@example.com');
    console.log('Пароль: admin123');
    
    // Показать все созданные роли
    const allRoles = await Role.find({});
    console.log('\nВсе роли в системе:');
    allRoles.forEach(role => {
      console.log(`- ${role.name} (ID: ${role._id}, Tenant: ${role.tenantID})`);
    });
    
    // Показать всех пользователей
    const allUsers = await User.find({});
    console.log('\nВсе пользователи в системе:');
    allUsers.forEach(user => {
      console.log(`- ${user.email} (ID: ${user._id}, Roles: ${user.roles.length})`);
    });
    
    // Проверить связи
    const adminWithRoles = await User.findOne({ email: 'admin@example.com' }).populate('roles');
    console.log('\nАдминистратор с ролями:');
    console.log(`- Email: ${adminWithRoles.email}`);
    console.log(`- Роли: ${adminWithRoles.roles.map(r => r.name).join(', ')}`);
    
  } catch (error) {
    console.error('Ошибка при исправлении ролей:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixRolesProperly();
