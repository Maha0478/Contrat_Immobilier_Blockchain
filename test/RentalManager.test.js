const RentalManager = artifacts.require("RentalManager");

contract("RentalManager", (accounts) => {
  const admin  = accounts[0];
  const owner  = accounts[1];
  const tenant = accounts[2];
  const other  = accounts[3];

  let instance;
  const RENT = web3.utils.toWei("0.05", "ether");

  beforeEach(async () => {
    instance = await RentalManager.new({ from: admin });
  });

  /* ── Admin ── */
  it("définit l'admin comme le déployeur", async () => {
    assert.equal(await instance.admin(), admin);
  });

  /* ── Création ── */
  it("permet au propriétaire de créer un contrat", async () => {
    const tx = await instance.createContract(tenant, RENT, 12, "12 Rue Hassan II", { from: owner });
    const ev = tx.logs[0].args;
    assert.equal(ev.owner, owner);
    assert.equal(ev.tenant, tenant);
    assert.equal(Number(await instance.contractCount()), 1);
  });

  it("rejette un locataire identique au propriétaire", async () => {
    try {
      await instance.createContract(owner, RENT, 12, "Bien", { from: owner });
      assert.fail("Devrait rejeter");
    } catch (e) {
      assert.include(e.message, "differents");
    }
  });

  /* ── Signature ── */
  it("permet au locataire de signer et active le contrat", async () => {
    await instance.createContract(tenant, RENT, 12, "Bien", { from: owner });
    await instance.signContract(1, { from: tenant });
    const c = await instance.getContract(1);
    assert.equal(Number(c.status), 1, "Statut doit être Actif");
    assert.equal(c.tenantSigned, true);
  });

  it("empêche un tiers de signer", async () => {
    await instance.createContract(tenant, RENT, 12, "Bien", { from: owner });
    try {
      await instance.signContract(1, { from: other });
      assert.fail();
    } catch (e) {
      assert.include(e.message, "locataire");
    }
  });

  /* ── Paiement ── */
  it("enregistre le paiement et transfère au propriétaire", async () => {
    await instance.createContract(tenant, RENT, 12, "Bien", { from: owner });
    await instance.signContract(1, { from: tenant });

    const before = BigInt(await web3.eth.getBalance(owner));
    await instance.payRent(1, { from: tenant, value: RENT });
    const after  = BigInt(await web3.eth.getBalance(owner));

    assert(after > before, "Le propriétaire doit recevoir le loyer");

    const payments = await instance.getPayments(1);
    assert.equal(payments.length, 1);
    assert.equal(payments[0].payer, tenant);
  });

  it("rejette un mauvais montant de loyer", async () => {
    await instance.createContract(tenant, RENT, 12, "Bien", { from: owner });
    await instance.signContract(1, { from: tenant });
    try {
      await instance.payRent(1, { from: tenant, value: web3.utils.toWei("0.01", "ether") });
      assert.fail();
    } catch (e) {
      assert.include(e.message, "incorrect");
    }
  });

  /* ── Résiliation admin ── */
  it("permet à l'admin de résilier un contrat actif", async () => {
    await instance.createContract(tenant, RENT, 12, "Bien", { from: owner });
    await instance.signContract(1, { from: tenant });
    await instance.terminateContract(1, { from: admin });
    const c = await instance.getContract(1);
    assert.equal(Number(c.status), 3, "Statut doit être Résilié");
  });

  it("empêche un non-admin de résilier", async () => {
    await instance.createContract(tenant, RENT, 12, "Bien", { from: owner });
    try {
      await instance.terminateContract(1, { from: owner });
      assert.fail();
    } catch (e) {
      assert.include(e.message, "admin");
    }
  });
});
