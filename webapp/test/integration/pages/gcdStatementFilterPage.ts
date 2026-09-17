import Opa5 from "sap/ui/test/Opa5";

const sViewName = "gcdStatementFilter";

export default class gcdStatementFilterPage extends Opa5 {
	// Actions


	// Assertions
	iShouldSeeThePageView() {
		return this.waitFor({
			id: "mainPage",
			viewName: sViewName,
			success: function () {
				Opa5.assert.ok(true, "The " + sViewName + " view is displayed");
			},
			errorMessage: "Did not find the " + sViewName + " view"
		});
	}

}
