export declare const apiName = "internal.contact.internalComplexPickerWithUid";
/**
 * 区别于internalComplexPicker，支持使用UID 进行选人中的勾选禁用需要 请求参数定义
 * @apiName internal.contact.internalComplexPickerWithUid
 */
export interface IInternalContactInternalComplexPickerWithUidParams {
    /** 标题 */
    title?: string;
    /** 企业的corpId */
    corpId: string;
    /** 企业的corpId */
    multiple?: boolean;
    /** 企业的corpId */
    limitTips?: string;
    /** 最大可选人数 */
    maxUsers?: number;
    /** 已选用户 UID列表 */
    pickedUsers?: number[];
    /** 已选部门 */
    pickedDepartments?: string[];
    /** 不可选用户UID列表 */
    disabledUsers?: number[];
    /** 不可选部门 */
    disabledDepartments?: string[];
    /** 必选用户（不可取消选中状态）UID列表 */
    requiredUsers: number[];
    /** 必选部门（不可取消选中状态） */
    requiredDepartments: string[];
    /** 微应用的Id */
    appId?: number;
    /** 可添加权限校验，选人权限，目前只有GLOBAL这个参数 */
    permissionType?: string;
    /** true：返回人员信息；false：返回人员和部门信息 */
    responseUserOnly?: boolean;
    /** 未选人时，底部提示文案 */
    showFriendPick?: string;
    /** 手机通讯录 */
    showMobileContactPick?: boolean;
    /** 组织架构选择 */
    showOrgRelationPick?: boolean;
    /** 按角色选择 */
    showLabelPick?: boolean;
    /** 外部联系人 */
    showExtContactPick?: boolean;
    /** -1表示从自己所在部门开始, 0表示从企业最上层开始，其他数字表示从该部门开始 */
    startWithDepartmentId?: string;
    showRootOrg?: boolean;
    limit?: number;
    canChooseCurrentUser?: boolean;
}
/**
 * 区别于internalComplexPicker，支持使用UID 进行选人中的勾选禁用需要 返回结果定义
 * @apiName internal.contact.internalComplexPickerWithUid
 */
export interface IInternalContactInternalComplexPickerWithUidResult {
    /** 选择人数 */
    selectedCount: number;
    /** 返回选人的列表 */
    users?: Array<{
        name: string;
        avatar?: string;
        uid: number;
        encryptionUid: any;
        emplId: any;
    }>;
    /** 返回已选部门列表 */
    departments?: Array<{
        id: any;
        name: string;
        number: number;
    }>;
}
/**
 * 区别于internalComplexPicker，支持使用UID 进行选人中的勾选禁用需要
 * @apiName internal.contact.internalComplexPickerWithUid
 * @supportVersion ios: 4.6.41; android: 4.6.41
 * @author ios: 云信; android: 长岚
 */
export declare function internalComplexPickerWithUid$(params: IInternalContactInternalComplexPickerWithUidParams): Promise<IInternalContactInternalComplexPickerWithUidResult>;
export default internalComplexPickerWithUid$;
