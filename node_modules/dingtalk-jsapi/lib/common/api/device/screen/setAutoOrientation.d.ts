export declare const apiName = "device.screen.setAutoOrientation";
/**
 * 开启H5屏幕旋转 请求参数定义
 * @apiName device.screen.setAutoOrientation
 */
export interface IDeviceScreenSetAutoOrientationParams {
    /** true开启屏幕旋转，false停止自动旋转（会重置为竖屏） */
    enable: boolean;
    /** Android是否隐藏状态栏，仅在横屏模式下适用，竖屏模式下强制展示状态栏;iOS横屏下默认隐藏状态栏 */
    showStatusBar?: boolean;
    /** 横屏是是否显示导航栏 */
    showNavBar?: boolean;
}
/**
 * 开启H5屏幕旋转 返回结果定义
 * @apiName device.screen.setAutoOrientation
 */
export interface IDeviceScreenSetAutoOrientationResult {
}
/**
 * 开启H5屏幕旋转
 * @apiName device.screen.setAutoOrientation
 * @supportVersion ios: 6.0.16 android: 6.0.16
 * @author Android：零封; iOS：无最
 */
export declare function setAutoOrientation$(params: IDeviceScreenSetAutoOrientationParams): Promise<IDeviceScreenSetAutoOrientationResult>;
export default setAutoOrientation$;
