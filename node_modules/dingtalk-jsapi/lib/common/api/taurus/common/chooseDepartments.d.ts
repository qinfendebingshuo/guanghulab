export declare const apiName = "taurus.common.chooseDepartments";
/**
 * 用于选部门场景的通讯录组件，该接口需要鉴权 请求参数定义
 * @apiName taurus.common.chooseDepartments
 */
export interface ITaurusCommonChooseDepartmentsParams {
    title?: string;
    multiple?: boolean;
    limitTips?: string;
    maxDepartments?: number;
    pickedDepartments?: string[];
    disabledDepartments?: string[];
    requiredDepartments?: string[];
}
export interface IDepartmentModel {
    id: string;
    name: string;
}
/**
 * 用于选部门场景的通讯录组件，该接口需要鉴权 返回结果定义
 * @apiName taurus.common.chooseDepartments
 */
export interface ITaurusCommonChooseDepartmentsResult {
    departmentsCount: number;
    departments: IDepartmentModel[];
}
/**
 * 用于选部门场景的通讯录组件，该接口需要鉴权
 * @apiName taurus.common.chooseDepartments
 * @supportVersion ios: 1.1.0 android: 1.1.0
 */
export declare function chooseDepartments$(params: ITaurusCommonChooseDepartmentsParams): Promise<ITaurusCommonChooseDepartmentsResult>;
export default chooseDepartments$;
