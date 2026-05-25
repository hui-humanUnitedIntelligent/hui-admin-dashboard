import { Router } from 'express';
import { updateProfile, updatePassword } from '../controllers/settings.controller';
const router = Router();
router.patch('/profile',  updateProfile);
router.patch('/password', updatePassword);
export default router;
