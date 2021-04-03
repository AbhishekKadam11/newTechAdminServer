var router = require('express').Router();
var controller = require('../controller');

router.get('/', controller.getMessage);
router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/dashboardCount', controller.dashboardCount);
router.get('/orderStatistics', controller.orderStatistics);
router.get('/orderByCustomer', controller.orderByCustomer);
router.get('/productDetails', controller.productDetails);
router.get('/productCategories', controller.productCategories);
router.get('/categoryList', controller.categoryList);
router.get('/productList', controller.productList);

module.exports = router;