export declare const apiName = "internal.cspace.requestDentryUrl";
/**
 * 通过spaceId和fileId获取文件的下载UR 请求参数定义
 * @apiName internal.cspace.requestDentryUrl
 */
export interface IInternalCspaceRequestDentryUrlParams {
    /** 钉盘空间ID */
    spaceId: string;
    /** 钉盘文件ID */
    fileId: string;
    /** 过期时间（单位：秒），目前服务端规则：默认30分钟，范围控制在0 - 3600秒 */
    expireSeconds?: number;
}
/**
 * 通过spaceId和fileId获取文件的下载UR 返回结果定义
 * @apiName internal.cspace.requestDentryUrl
 */
export interface IInternalCspaceRequestDentryUrlResult {
    /** 文件的Url */
    fileUrl: string;
    /** 随机签名盐值 */
    code: string;
}
/**
 * 通过spaceId和fileId获取文件的下载UR
 * @apiName internal.cspace.requestDentryUrl
 * @supportVersion ios: 4.6.37 android: 4.6.37
 */
export declare function requestDentryUrl$(params: IInternalCspaceRequestDentryUrlParams): Promise<IInternalCspaceRequestDentryUrlResult>;
export default requestDentryUrl$;
