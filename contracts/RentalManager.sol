// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title RentalManager
 * @notice Système de Gestion des Contrats de Location Immobilière via Blockchain
 * @dev Groupe 5 - Ghassat Maha, Ben-achour Oussama, Alaoui Belghiti Niema
 */
contract RentalManager {

    address public admin;

    enum ContractStatus { Pending, Active, Expired, Terminated }

    struct RentalContract {
        uint256 id;
        address payable owner;
        address payable tenant;
        uint256 rentAmount;       // in wei
        uint256 startDate;        // timestamp
        uint256 durationMonths;   // number of months
        uint256 endDate;          // timestamp
        ContractStatus status;
        bool tenantSigned;
        uint256 totalPaid;
        string propertyAddress;  // description du bien
    }

    struct Payment {
        uint256 contractId;
        address payer;
        uint256 amount;
        uint256 timestamp;
    }

    uint256 public contractCount;

    mapping(uint256 => RentalContract) public contracts;
    mapping(uint256 => Payment[]) public payments;
    mapping(address => uint256[]) public ownerContracts;
    mapping(address => uint256[]) public tenantContracts;

    /* ─── Events ─── */
    event ContractCreated(
        uint256 indexed id,
        address indexed owner,
        address indexed tenant,
        uint256 rentAmount,
        uint256 durationMonths
    );
    event ContractSigned(uint256 indexed id, address indexed tenant);
    event PaymentMade(uint256 indexed id, address indexed tenant, uint256 amount, uint256 timestamp);
    event ContractExpired(uint256 indexed id);
    event ContractTerminated(uint256 indexed id);

    /* ─── Modifiers ─── */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Seul l'admin peut effectuer cette action");
        _;
    }

    modifier onlyContractOwner(uint256 _id) {
        require(contracts[_id].owner == msg.sender, "Seul le proprietaire peut effectuer cette action");
        _;
    }

    modifier onlyContractTenant(uint256 _id) {
        require(contracts[_id].tenant == msg.sender, "Seul le locataire peut effectuer cette action");
        _;
    }

    modifier contractExists(uint256 _id) {
        require(_id > 0 && _id <= contractCount, "Contrat inexistant");
        _;
    }

    /* ─── Constructor ─── */
    constructor() {
        admin = msg.sender;
    }

    /* ─── Owner Functions ─── */

    /**
     * @notice Crée un nouveau contrat de location
     */
    function createContract(
        address payable _tenant,
        uint256 _rentAmount,
        uint256 _durationMonths,
        string calldata _propertyAddress
    ) external returns (uint256) {
        require(_tenant != address(0), "Adresse locataire invalide");
        require(_tenant != msg.sender, "Proprietaire et locataire doivent etre differents");
        require(_rentAmount > 0, "Loyer doit etre superieur a 0");
        require(_durationMonths > 0 && _durationMonths <= 120, "Duree invalide (1-120 mois)");

        contractCount++;
        uint256 _endDate = block.timestamp + (_durationMonths * 30 days);

        contracts[contractCount] = RentalContract({
            id: contractCount,
            owner: payable(msg.sender),
            tenant: _tenant,
            rentAmount: _rentAmount,
            startDate: block.timestamp,
            durationMonths: _durationMonths,
            endDate: _endDate,
            status: ContractStatus.Pending,
            tenantSigned: false,
            totalPaid: 0,
            propertyAddress: _propertyAddress
        });

        ownerContracts[msg.sender].push(contractCount);
        tenantContracts[_tenant].push(contractCount);

        emit ContractCreated(contractCount, msg.sender, _tenant, _rentAmount, _durationMonths);
        return contractCount;
    }

    /* ─── Tenant Functions ─── */

    /**
     * @notice Le locataire signe le contrat pour l'activer
     */
    function signContract(uint256 _contractId)
        external
        contractExists(_contractId)
        onlyContractTenant(_contractId)
    {
        RentalContract storage c = contracts[_contractId];
        require(c.status == ContractStatus.Pending, "Contrat non en attente");
        require(!c.tenantSigned, "Contrat deja signe");

        c.tenantSigned = true;
        c.status = ContractStatus.Active;

        emit ContractSigned(_contractId, msg.sender);
    }

    /**
     * @notice Le locataire effectue le paiement du loyer
     */
    function payRent(uint256 _contractId)
        external
        payable
        contractExists(_contractId)
        onlyContractTenant(_contractId)
    {
        RentalContract storage c = contracts[_contractId];
        require(c.status == ContractStatus.Active, "Contrat non actif");
        require(msg.value == c.rentAmount, "Montant du loyer incorrect");
        require(block.timestamp <= c.endDate, "Contrat expire");

        c.owner.transfer(msg.value);
        c.totalPaid += msg.value;

        payments[_contractId].push(Payment({
            contractId: _contractId,
            payer: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        }));

        emit PaymentMade(_contractId, msg.sender, msg.value, block.timestamp);
    }

    /* ─── Admin Functions ─── */

    /**
     * @notice L'admin peut résilier un contrat en cas de litige
     */
    function terminateContract(uint256 _contractId)
        external
        onlyAdmin
        contractExists(_contractId)
    {
        RentalContract storage c = contracts[_contractId];
        require(
            c.status == ContractStatus.Active || c.status == ContractStatus.Pending,
            "Contrat deja termine ou expire"
        );
        c.status = ContractStatus.Terminated;
        emit ContractTerminated(_contractId);
    }

    /* ─── Public / View Functions ─── */

    /**
     * @notice Met à jour le statut si le contrat est expiré
     */
    function checkAndUpdateExpiry(uint256 _contractId)
        external
        contractExists(_contractId)
    {
        RentalContract storage c = contracts[_contractId];
        if (c.status == ContractStatus.Active && block.timestamp > c.endDate) {
            c.status = ContractStatus.Expired;
            emit ContractExpired(_contractId);
        }
    }

    /**
     * @notice Retourne tous les paiements d'un contrat
     */
    function getPayments(uint256 _contractId)
        external
        view
        contractExists(_contractId)
        returns (Payment[] memory)
    {
        return payments[_contractId];
    }

    /**
     * @notice Retourne les IDs des contrats d'un propriétaire
     */
    function getOwnerContracts(address _owner) external view returns (uint256[] memory) {
        return ownerContracts[_owner];
    }

    /**
     * @notice Retourne les IDs des contrats d'un locataire
     */
    function getTenantContracts(address _tenant) external view returns (uint256[] memory) {
        return tenantContracts[_tenant];
    }

    /**
     * @notice Retourne les détails complets d'un contrat
     */
    function getContract(uint256 _contractId)
        external
        view
        contractExists(_contractId)
        returns (RentalContract memory)
    {
        return contracts[_contractId];
    }
}
