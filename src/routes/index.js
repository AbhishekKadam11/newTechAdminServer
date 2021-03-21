var router = require('express').Router();
var controller = require('../controller');

router.get('/', controller.getMessage);
router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/dashboardCount', controller.dashboardCount);

module.exports = router;