var router = require('express').Router();
var controller = require('../controller');

router.get('/', controller.getMessage);
router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/dashboardCount', controller.dashboardCount);
router.get('/orderStatistics', controller.orderStatistics);
router.get('/orderByCustomer', controller.orderByCustomer);

module.exports = router;