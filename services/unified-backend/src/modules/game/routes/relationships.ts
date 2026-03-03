import { Router } from 'express';
import { RelationshipController } from '../controllers/RelationshipController';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';

const router = Router();

/**
 * @route GET /relationships
 * @desc Get character's relationships
 * @access Private (Character required)
 */
router.get('/',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:relationships:list'),
  RelationshipController.getMyRelationships
);

/**
 * @route GET /relationships/types
 * @desc Get available relationship types
 * @access Private (Character required)
 */
router.get('/types',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:relationships:types'),
  RelationshipController.getRelationshipTypes
);

/**
 * @route POST /relationships
 * @desc Propose new relationship
 * @access Private (Character required)
 */
router.post('/',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:relationships:propose'),
  RelationshipController.proposeRelationship
);

/**
 * @route PUT /relationships/:relationshipId/respond
 * @desc Respond to relationship proposal
 * @access Private (Character required)
 */
router.put('/:relationshipId/respond',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:relationships:respond'),
  RelationshipController.respondToProposal
);

/**
 * @route DELETE /relationships/:relationshipId
 * @desc End established relationship
 * @access Private (Character required)
 */
router.delete('/:relationshipId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:relationships:end'),
  RelationshipController.endRelationship
);

export default router;