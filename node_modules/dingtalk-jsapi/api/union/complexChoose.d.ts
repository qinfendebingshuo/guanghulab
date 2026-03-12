import { ICommonAPIParams } from '../../constant/types';
/**
 * 选人与部门 请求参数定义
 * @apiName complexChoose
 */
export interface IUnionComplexChooseParams extends ICommonAPIParams {
    appId: string;
    title: string;
    corpId: string;
    deptId: string;
    maxUsers: number;
    multiple: boolean;
    rootPage: string;
    limitTips: string;
    pickedUsers: string[];
    disabledUsers: string[];
    requiredUsers: string[];
    showLabelPick: boolean;
    responseUserOnly: boolean;
    pickedDepartments: string[];
    showOrgEcological: boolean;
    disabledDepartments: string[];
    filterOrgEcological: boolean;
    requiredDepartments: string[];
    startWithDepartmentId: string;
}
/**
 * 选人与部门 返回结果定义
 * @apiName complexChoose
 */
export interface IUnionComplexChooseResult {
    users: {
        name: string;
        avatar: string;
        emplId: string;
    }[];
    departments: {
        id: string;
        name: string;
        number: number;
    }[];
    selectedCount: number;
}
/**
 * 选人与部门
 * @apiName complexChoose
 */
export declare function complexChoose$(params: IUnionComplexChooseParams): Promise<IUnionComplexChooseResult>;
export default complexChoose$;
