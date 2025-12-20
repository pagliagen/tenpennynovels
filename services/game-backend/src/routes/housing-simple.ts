import { Router } from 'express';

const router = Router();

// Simple test route
router.get('/housing/test', (req, res) => {
  res.json({
    success: true,
    message: 'Housing routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Districts endpoint  
router.get('/housing/districts', (req, res) => {
  res.json({
    success: true,
    data: { 
      districts: [
        { _id: 'Whitechapel', totalProperties: 15, averageRent: 25 },
        { _id: 'Mayfair', totalProperties: 8, averageRent: 150 }
      ] 
    },
    timestamp: new Date().toISOString()
  });
});

// Available properties endpoint
router.get('/housing/available/:district', (req, res) => {
  const { district } = req.params;
  const properties = district === 'Whitechapel' ? [
    {
      _id: '507f1f77bcf86cd799439011',
      district: 'Whitechapel',
      propertyType: 'basic_room',
      monthlyRent: 25
    }
  ] : [
    {
      _id: '507f1f77bcf86cd799439012', 
      district: 'Mayfair',
      propertyType: 'luxury_suite',
      monthlyRent: 150
    }
  ];
  
  res.json({
    success: true,
    data: { properties },
    timestamp: new Date().toISOString()
  });
});

// My properties endpoint  
router.get('/housing/my-properties', (req, res) => {
  res.json({
    success: true,
    data: { 
      properties: [
        {
          _id: '507f1f77bcf86cd799439013',
          district: 'Whitechapel',
          propertyType: 'basic_room',
          ownershipType: 'rental',
          monthlyRent: 25,
          condition: 'good',
          locationId: {
            name: 'Whitechapel District',
            description: 'A working-class area of London'
          },
          features: {
            furnished: false,
            hasKitchen: false,
            hasPrivateBathroom: false,
            roomCount: 1
          },
          rentStatus: {
            isOverdue: false,
            daysOverdue: 0,
            nextPaymentDue: new Date(Date.now() + 30*24*60*60*1000).toISOString()
          }
        }
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// Property details endpoint
router.get('/housing/:propertyId', (req, res) => {
  const { propertyId } = req.params;
  res.json({
    success: true,
    data: { 
      property: {
        _id: propertyId,
        district: 'Whitechapel',
        propertyType: 'basic_room',
        ownershipType: 'available',
        monthlyRent: 25,
        features: {
          furnished: false,
          hasKitchen: false,
          hasPrivateBathroom: false,
          roomCount: 1
        }
      },
      transactions: [],
      rentStatus: null
    },
    timestamp: new Date().toISOString()
  });
});

export { router as housingRoutes };