import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  employeeId: { type: String, required: true },
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  phone: { type: String, default: "" },
  role: { type: String, enum: ['ROLE_ADMIN', 'ROLE_EMPLOYEE'], required: true },
  active: { type: Boolean, default: true },
  department: { type: String, default: "" }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
