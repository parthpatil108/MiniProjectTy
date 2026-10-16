import { StorageManager } from '../storage/storageManager.js';
import { hashPassword, verifyPassword, UserRole } from '@apnileap/common';

export interface UserRecord {
  user_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
  failed_login_attempts?: number;
  locked_until?: string | null;
  [key: string]: any;
}

export class UserService {
  private static instance: UserService | null = null;
  private storage: StorageManager;

  constructor(storageManager?: StorageManager) {
    this.storage = storageManager || StorageManager.getInstance();
  }

  public static getInstance(storageManager?: StorageManager): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService(storageManager);
    }
    return UserService.instance;
  }

  public static resetInstance(): void {
    UserService.instance = null;
  }

  public async createUser(data: {
    user_id: string;
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }): Promise<UserRecord> {
    const table = this.storage.getTable<UserRecord>('users');
    const existing = table.getById(data.user_id) || this.findByEmail(data.email);
    if (existing) {
      throw new Error(`User with ID '${data.user_id}' or email '${data.email}' already exists`);
    }

    const password_hash = await hashPassword(data.password);
    const user: UserRecord = {
      user_id: data.user_id,
      name: data.name,
      email: data.email.toLowerCase(),
      password_hash,
      role: data.role,
      created_at: new Date().toISOString(),
      failed_login_attempts: 0,
      locked_until: null,
    };

    return table.insert(user);
  }

  public findById(userId: string): UserRecord | null {
    const table = this.storage.getTable<UserRecord>('users');
    return table.getById(userId) || null;
  }

  public findByEmail(email: string): UserRecord | null {
    const table = this.storage.getTable<UserRecord>('users');
    const normalized = email.toLowerCase().trim();
    const result = table.query({
      filter: { email: normalized },
      limit: 1,
    });
    return result.records[0] || null;
  }

  public async authenticate(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    const user = this.findByEmail(email);
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Check account lockout
    if (user.locked_until) {
      const lockExpiry = new Date(user.locked_until).getTime();
      if (Date.now() < lockExpiry) {
        const remainingSec = Math.ceil((lockExpiry - Date.now()) / 1000);
        return { success: false, error: `Account locked due to excessive failed logins. Try again in ${remainingSec}s.` };
      }
    }

    const passwordMatches = await verifyPassword(password, user.password_hash);
    const table = this.storage.getTable<UserRecord>('users');

    if (!passwordMatches) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      let locked_until: string | null = null;
      if (attempts >= 5) {
        // Lock account for 5 minutes
        locked_until = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      }
      table.update(user.user_id, {
        failed_login_attempts: attempts,
        locked_until,
      });
      return { success: false, error: 'Invalid email or password' };
    }

    // Reset failed login attempts on successful login
    if ((user.failed_login_attempts || 0) > 0 || user.locked_until) {
      table.update(user.user_id, {
        failed_login_attempts: 0,
        locked_until: null,
      });
    }

    return { success: true, user };
  }

  public async seedDefaultUsers(): Promise<number> {
    const demoAccounts: Array<{
      user_id: string;
      name: string;
      email: string;
      password: string;
      role: UserRole;
    }> = [
      {
        user_id: 'ADM-1000',
        name: 'Parth Patil',
        email: 'parthpatil@gmail.com',
        password: 'demo123',
        role: 'Placement_Admin',
      },
      {
        user_id: 'STU-1001',
        name: 'Rahul Sharma',

        email: 'student@apnileap.edu',
        password: 'demo123',
        role: 'Student',
      },
      {
        user_id: 'STU-1002',
        name: 'Priya Patel',
        email: 'student@placify.edu',
        password: 'demo123',
        role: 'Student',
      },
      {
        user_id: 'TPO-2001',
        name: 'Dr. Amit Nair',
        email: 'faculty@apnileap.edu',
        password: 'demo123',
        role: 'Faculty_TPO',
      },
      {
        user_id: 'TPO-2002',
        name: 'Prof. S. Rao',
        email: 'faculty@placify.edu',
        password: 'demo123',
        role: 'Faculty_TPO',
      },
      {
        user_id: 'ADM-3001',
        name: 'Rhea Verma',
        email: 'admin@apnileap.edu',
        password: 'demo123',
        role: 'Placement_Admin',
      },
      {
        user_id: 'ADM-3002',
        name: 'Placement Directorate',
        email: 'admin@placify.edu',
        password: 'demo123',
        role: 'Placement_Admin',
      },
    ];

    let count = 0;
    for (const acc of demoAccounts) {
      if (!this.findByEmail(acc.email)) {
        await this.createUser(acc);
        count++;
      }
    }

    this.storage.saveAllTables();
    return count;
  }
}
