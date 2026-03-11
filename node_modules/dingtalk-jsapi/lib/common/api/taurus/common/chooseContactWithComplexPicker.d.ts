import { SelectVersionEnum, PanelTypeEnum, VisibilityCodesEnum } from './chooseContact';
export declare const apiName = "taurus.common.chooseContactWithComplexPicker";
/**
 * 用于选人选部门场景的通讯录组件，在 v1.6.2 版本之后，建议都使用本接口进行选人和选部门的操作，该接口需要鉴权 请求参数定义
 * @apiName taurus.common.chooseContactWithComplexPicker
 */
export interface ITaurusCommonChooseContactWithComplexPickerParams {
    title?: string;
    limitTips?: string;
    multiple?: boolean;
    maxUsers?: number;
    pickedUsers?: string[];
    disabledUsers?: string[];
    requiredUsers?: string[];
    disabledDepartments?: string[];
    pickedDepartments?: string[];
    requiredDepartments?: string[];
    responseUserOnly?: boolean;
    selectVersion?: SelectVersionEnum;
    panelTypes?: PanelTypeEnum[];
    visibilityCodes?: VisibilityCodesEnum;
    enableExternalUser?: boolean;
    organizationToPerson?: boolean;
}
export interface IDepartmentModel {
    id: string;
    name: string;
}
export interface IUserModel {
    name: string;
    avatar?: string;
    userid: string;
}
/**
 * 用于选人选部门场景的通讯录组件，在 v1.6.2 版本之后，建议都使用本接口进行选人和选部门的操作，该接口需要鉴权 返回结果定义
 * @apiName taurus.common.chooseContactWithComplexPicker
 */
export interface ITaurusCommonChooseContactWithComplexPickerResult {
    selectedCount: number;
    users: IUserModel[];
    departments: IDepartmentModel[];
}
/**
 * 用于选人选部门场景的通讯录组件，在 v1.6.2 版本之后，建议都使用本接口进行选人和选部门的操作，该接口需要鉴权
 * @apiName taurus.common.chooseContactWithComplexPicker
 * @supportVersion ios: 1.1.0 android: 1.1.0
 */
export declare function chooseContactWithComplexPicker$(params: ITaurusCommonChooseContactWithComplexPickerParams): Promise<ITaurusCommonChooseContactWithComplexPickerResult>;
export default chooseContactWithComplexPicker$;
