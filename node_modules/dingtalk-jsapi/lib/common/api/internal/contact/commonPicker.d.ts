export declare const apiName = "internal.contact.commonPicker";
/**
 * 唤起picker，可选各组织部门/群组/联系人 请求参数定义
 * @apiName internal.contact.commonPicker
 */
export interface IInternalContactCommonPickerParams {
    /** 标题  */
    title?: string;
    /** 已选用户 UID列表，long类型	 */
    pickedUsers?: number[];
    /** 已选部门，dict包含 id与orgId，long类型 */
    pickedDepartments?: Array<{
        id: number;
        orgId: number;
    }>;
    /** 已选群组，dict包含id，string类型 */
    pickedGroups?: Array<{
        id: string;
    }>;
    /** 是否展示我的好友，默认YES */
    showFriendPick?: boolean;
    /** 是否展示常用联系人，默认YES */
    showUsualContactPick?: boolean;
    /** 是否展示我的群组，默认YES */
    showGroupPick?: boolean;
    /** 是否多选 */
    multiple?: boolean;
}
/**
 * 唤起picker，可选各组织部门/群组/联系人 返回结果定义
 * @apiName internal.contact.commonPicker
 */
export interface IInternalContactCommonPickerResult {
    selectedCount: number;
    users: Array<{
        name: string;
        avatar: string;
        uid: number;
    }>;
    departments?: Array<{
        id: number;
        name: string;
        number: number;
        orgId: number;
    }>;
    groups?: Array<{
        cid: string;
        number: number;
        name: string;
        avatar: string;
    }>;
}
/**
 * 唤起picker，可选各组织部门/群组/联系人
 * @apiName internal.contact.commonPicker
 * @supportVersion ios: 5.1.15 android: 5.1.15
 * @author iOS：壹原；Android：几米
 */
export declare function commonPicker$(params: IInternalContactCommonPickerParams): Promise<IInternalContactCommonPickerResult>;
export default commonPicker$;
