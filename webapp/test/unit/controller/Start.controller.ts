/*global QUnit */
export {};

QUnit.module("Start Controller");

QUnit.test("The start controller loads", function (assert: Assert) {
	const done = assert.async();
	sap.ui.require(["adobeform/controller/Start.controller"], function (Controller: new (name: string) => object) {
		const oController = new Controller("Start");
		assert.ok(oController);
		done();
	});
});
