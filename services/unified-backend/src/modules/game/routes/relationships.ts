import { Router } from 'express';
import { RelationshipController } from '../controllers/RelationshipController';

const router = Router();

/**
 * @route GET /relationships
 * @desc Get character's relationships
 * @access Private (Character required)
 */
router.get('/', RelationshipController.getMyRelationships);

/**
 * @route GET /relationships/types
 * @desc Get available relationship types
 * @access Private (Character required)
 */
router.get('/types', RelationshipController.getRelationshipTypes);

/**
 * @route POST /relationships
 * @desc Propose new relationship
 * @access Private (Character required)
 */
router.post('/', RelationshipController.proposeRelationship);

/**
 * @route PUT /relationships/:relationshipId/respond
 * @desc Respond to relationship proposal
 * @access Private (Character required)
 */
router.put('/:relationshipId/respond', RelationshipController.respondToProposal);

/**
 * @route DELETE /relationships/:relationshipId
 * @desc End established relationship
 * @access Private (Character required)
 */
router.delete('/:relationshipId', RelationshipController.endRelationship);

export default router;