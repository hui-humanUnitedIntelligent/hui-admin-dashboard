import { Router } from 'express';
import { getUsers, getUserById, updateUserStatus, deleteUser } from '../controllers/users.controller';

const router = Router();

router.get('/',               getUsers);
router.get('/:id',            getUserById);
router.patch('/:id/status',   updateUserStatus);
router.delete('/:id',         deleteUser);

export default router;
