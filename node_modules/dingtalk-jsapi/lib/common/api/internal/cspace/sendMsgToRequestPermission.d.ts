export declare const apiName = "internal.cspace.sendMsgToRequestPermission";
/**
 * 发送消息用于申请文档权限 请求参数定义
 * @apiName internal.cspace.sendMsgToRequestPermission
 */
export interface IInternalCspaceSendMsgToRequestPermissionParams {
    /** 文档的空间id  */
    spaceId: string;
    /** 文档的id */
    dentryId: string;
    /** 文档名 */
    dentryName: string;
    /** 加密的uid */
    encryptionUid: string;
    message?: string;
}
/**
 * 发送消息用于申请文档权限 返回结果定义
 * @apiName internal.cspace.sendMsgToRequestPermission
 */
export interface IInternalCspaceSendMsgToRequestPermissionResult {
}
/**
 * 发送消息用于申请文档权限
 * @apiName internal.cspace.sendMsgToRequestPermission
 * @supportVersion ios: 4.5.21 android: 4.5.21
 */
export declare function sendMsgToRequestPermission$(params: IInternalCspaceSendMsgToRequestPermissionParams): Promise<IInternalCspaceSendMsgToRequestPermissionResult>;
export default sendMsgToRequestPermission$;
