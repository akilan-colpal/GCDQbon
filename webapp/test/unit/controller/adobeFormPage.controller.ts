/*global QUnit*/
import Controller from "adobeform/controller/adobeForm.controller";

QUnit.module("adobeForm Controller");

QUnit.test("I should test the adobeForm controller", function (assert: Assert) {
	const oAppController = new Controller("adobeForm");
	oAppController.onInit();
	assert.ok(oAppController);
});