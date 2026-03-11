export declare const apiName = "biz.util.editPicture";
/**
 * 编辑图片功能 请求参数定义
 * @apiName biz.util.editPicture
 */
export interface IBizUtilEditPictureParams {
    /** 图片的远端路径或者本地虚拟路径 */
    url: string;
    /** 新窗口 title ，pc 端支持 */
    windowTitle?: string;
}
/**
 * 编辑图片功能 返回结果定义
 * @apiName biz.util.editPicture
 */
export interface IBizUtilEditPictureResult {
    /** 本地虚拟路径 */
    path: string;
}
/**
 * 编辑图片功能
 * @apiName biz.util.editPicture
 * @supportVersion ios: 4.7.32 android: 4.7.32
 * @author Android：卓剑, iOS：须莫
 */
export declare function editPicture$(params: IBizUtilEditPictureParams): Promise<IBizUtilEditPictureResult>;
export default editPicture$;
