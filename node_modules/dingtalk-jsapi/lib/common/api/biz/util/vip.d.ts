export declare const apiName = "biz.util.vip";
/**
 * vip监控 请求参数定义，参考 https://yuque.antfin-inc.com/dingtalk_ios/rriv6z/bdgoh8 https://pre-wsdebug.dingtalk.com/
 * @apiName biz.util.vip
 */
export interface IBizUtilVipParams {
    /** 申请的 moduleName */
    moduleName: string;
    /** 申请的 subtype */
    subtype: number | string;
    /** 上报文本内容 */
    desc: string;
    /** 主企业 corpId */
    corpId: string;
    /** 上报 key-value 数据 */
    extra: {
        [key: string]: any;
    };
}
/**
 * vip监控 返回结果定义
 * @apiName biz.util.vip
 */
export interface IBizUtilVipResult {
    [key: string]: any;
}
/**
 * vip监控
 * @apiName biz.util.vip
 * @supportVersion  ios: 3.3.0 android: 3.3.0 pc: 5.1.6
 * @author mac 口合, Windows：口合
 */
export declare function vip$(params: IBizUtilVipParams): Promise<IBizUtilVipResult>;
export default vip$;
