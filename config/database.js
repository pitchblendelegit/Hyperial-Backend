import { Sequelize } from 'sequelize';

const sequelize = new Sequelize('hyperialdb', 'root', '', {
  host: 'localhost',
  dialect: 'mysql',
});

export default sequelize;