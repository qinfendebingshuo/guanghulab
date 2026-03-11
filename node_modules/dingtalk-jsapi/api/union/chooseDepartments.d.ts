import { ICommonAPIParams } from '../../constant/types';
/**
 * 选择部门信息 请求参数定义
 * @apiName chooseDepartments
 */
export interface IUnionChooseDepartmentsParams extends ICommonAPIParams {
    appId: string;
    title: string;
    corpId: string;
    multiple: boolean;
    limitTips: string;
    maxDepartments: number;
    pickedDepartments: string[];
    disabledDepartments: string[];
    requiredDepartments: string[];
}
/**
 * 选择部门信息 返回结果定义
 * @apiName chooseDepartments
 */
export interface IUnionChooseDepartmentsResult {
    userCount: number;
    departments: {
        id: string;
        name: string;
        number: number;
    }[];
    departmentsCount: number;
}
/**
 * 选择部门信息
 * @apiName chooseDepartments
 */
export declare function chooseDepartments$(params: IUnionChooseDepartmentsParams): Promise<IUnionChooseDepartmentsResult>;
export default chooseDepartments$;
