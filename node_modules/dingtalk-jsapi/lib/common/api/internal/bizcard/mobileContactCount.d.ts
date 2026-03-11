export declare const apiName = "internal.bizcard.mobileContactCount";
/**
 * 获取用户手机联系人人数 请求参数定义
 * @apiName internal.bizcard.mobileContactCount
 */
export interface IInternalBizcardMobileContactCountParams {
    [key: string]: any;
}
/**
 * 获取用户手机联系人人数 返回结果定义
 * @apiName internal.bizcard.mobileContactCount
 * number 人数
 */
export declare type IInternalBizcardMobileContactCountResult = number;
/**
 * 获取用户手机联系人人数
 * @apiName internal.bizcard.mobileContactCount
 * @supportVersion ios: 4.5.21 android: 4.5.21
 */
export declare function mobileContactCount$(params: IInternalBizcardMobileContactCountParams): Promise<IInternalBizcardMobileContactCountResult>;
export default mobileContactCount$;
