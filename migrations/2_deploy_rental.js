const RentalManager = artifacts.require("RentalManager");

module.exports = function (deployer) {
  deployer.deploy(RentalManager);
};
