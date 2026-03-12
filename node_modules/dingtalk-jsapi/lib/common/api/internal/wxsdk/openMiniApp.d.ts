export declare const apiName = "internal.wxsdk.openMiniApp";
/**
 * 拉起微信小程序 请求参数定义
 * @apiName internal.wxsdk.openMiniApp
 */
export interface IInternalWxsdkOpenMiniAppParams {
    /** 微信开发者账号对应AppId, 该AppId注册时必须绑定钉钉包名com.alibaba.android.rimet, 且与小程序绑定 */
    wxSdkAppId: string;
    /** 小程序原始id, 如"gh_d43f693ca31f", 非wx开头的小程序id */
    originalMiniAppId: string;
    /** 小程序页面参数query部分, 如 "?parama=1&foo=bar" */
    query?: string;
    /** 小程序版本, release=0; test=1;preview=2; */
    miniAppType?: string;
}
/**
 * 拉起微信小程序 返回结果定义
 * @apiName internal.wxsdk.openMiniApp
 */
export interface IInternalWxsdkOpenMiniAppResult {
}
/**
 * 拉起微信小程序
 * @apiName internal.wxsdk.openMiniApp
 * @supportVersion ios: 4.7.16 android: 4.7.16
 * @author Android：泽乾; iOS：姚曦
 */
export declare function openMiniApp$(params: IInternalWxsdkOpenMiniAppParams): Promise<IInternalWxsdkOpenMiniAppResult>;
export default openMiniApp$;
