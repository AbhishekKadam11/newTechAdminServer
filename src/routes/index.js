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
router.get('/customerList', controller.customerList);
router.get('/customerDetails', controller.customerDetails);
router.post('/uploads', controller.multerUpload.single('file'), controller.uploads);
router.post('/productUpload', controller.productUpload);
router.get('/getFile', controller.getFile);
router.get('/customerbuyProduct', controller.customerbuyProduct);
router.get('/productReview', controller.productReview);
router.put('/productUpdate', controller.productUpdate);
router.put('/customerUpdate', controller.customerUpdate);
router.get('/orderCountByCustomer', controller.orderCountByCustomer);
router.get('/orderList', controller.orderList);
router.get('/stateList', controller.stateList);
router.get('/cityList', controller.cityList);
router.get('/stateWiseCount', controller.stateWiseCount);

module.exports = router;