Created by 韦庭德, last modified by  徐凡博 on 三月 05, 2024

# **一.**  ** **  **概述**

当正常的停止命令无法停止DB时， 而用户又想立即停止DB。强制停止功能通过发送SIGKILL信号使DB进程强制退出。

停止脚本不使用密码，而是将操作者设置  YASDBA用户组成员，通过yasql登录数据库，执行shutdown   。

SR:     [YDBRD-15229](https://jira.yasdb.com/browse/YDBRD-15229?src=confmacro)    -  【共享集群】YCS支持强制停止  完成

开发设计文档：    [【YCS】YCS支持强制停止](119546766.html)  

# **二.**  ** **  **需求分析**

1. 停止DB过程中实现强制停止DB；
1. 停止结点实现停止结点
1. 停止脚本不使用密码；
1. YCS监测到DB异常停止后更新相应状态和topo结构。


# **三.**  ** **  **测试设计方法**

等价类，正交，场景。

  


# **四.**  ** **  **详细测试设计**

强制停止DB，就向DB的进程发送SIGKILL信号(kill -9)。DB的进程号是通过DB在的握手协议里传给YCS。

在停止DB时，先执行正常停止命令，再执行强制停止。通过参数控制如何执行强制停止。具体实现如下：

通过参数WAIT_STOP_FIN_TIME（等待正常停止结束时间）控制强制停止的执行，范围设置在[0, 300] 秒。    
  WAIT_STOP_FIN_TIME=0                  表示永远不执行强制停止，一直等待正常停止结束    
  0 < WAIT_STOP_FIN_TIME <= 300  表示在WAIT_STOP_FIN_TIME时间之后数据库未停止，则执行强制停止    
  WAIT_STOP_FIN_TIME                      默认值设置为90秒

## 约束

DB在线恢复还没做，强制停止DB，再重新启动可能会有异常    
  启动ycs服务，同时启动DB和YFS    
  DB资源依赖ycs服务，必须先启动ycs才可以使用    
  ycs停止后，所有资源不可用    
  执行ycsctl stop instance只停止DB资源    
  执行ycsctl stop ycs强制停止DB过程中，YCS 自身或是YFS卡住，需要手动杀YCS进程    
  执行ycsctl stop ycs，资源停止时是先停止DB，再停止yfs，最后才停止YCS    
  无密码停止脚本，操作系统用户需是YASDBA用户组成员，通过yasql登录数据库，执行shutdown

[YCS支持强制停止测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2M4OTcwYzJhZjRmNTFmYTkzIiwicmVmX2lkIjoiNjczOTY5Y2M3MjgyMDZlZmI5MmVmNzc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDE5LCJleHAiOjE3ODIyOTU0MTl9.mVhyKsceprxL_Eg1-PNlVOVBz1RAq8wlIKfUVCdbs_w)

# **五.**  ** **  **测试用例**

|功能|操作|预期|备注|
|---|---|---|---|
|yascs.ini配置文件校验（此SR新增参数WAIT_STOP_FIN_TIME）    
  取值范围   0~300 秒    
    
|WAIT_STOP_FIN_TIME = 0|永远不执行强制停止，一直等待正常停止结束|  
  AUTO_START覆盖ALWAYS和NEVER场景下|
||WAIT_STOP_FIN_TIME = 100|在WAIT_STOP_FIN_TIME时间100s之后数据库未停止，则执行强制停止||
||WAIT_STOP_FIN_TIME = 300|在WAIT_STOP_FIN_TIME时间300s之后数据库未停止，则执行强制停止||
||AIT_STOP_FIN_TIME 参数不设置|默认值设置为90s，在时间90s之后数据库未停止，则执行强制停止||
||WAIT_STOP_FIN_TIME = -1|负值小于0--启动时报错，报错信息指向性是否明确,无core生成||
||WAIT_STOP_FIN_TIME = 301|值大于300--启动时报错, 报错信息指向性是否明确,无core生成||
||空值|启动时报错, 报错信息指向性是否明确,无core生成||
||特殊字符|启动时报错, 报错信息指向性是否明确,无core生成||
||同一参数设置重复、两个值|启动时报错, 报错信息指向性是否明确,无core生成    
  与原有参数调换位置---不会报错||
||每个实例设置不同的值|每个实例的强制停止时间不受影响||
|instance启停|1、YCS主节点、DB主节点，执行 ycsctl stop instance|DB状态变为offline，并且DB成功选出新的主节点|  
|
||以上操作后，执行ycsctl start instance|DB状态由offline变为online||
||2、YCS主节点、DB备节点，执行 ycsctl stop instance|DB状态变为offline，并且DB主节点保持不变||
||以上操作后，执行ycsctl start instance|DB状态由offline变为online||
||3、YCS备节点、DB主节点，执行 ycsctl stop instance|DB状态变为offline，并且DB成功选出新的主节点||
||以上操作后，执行ycsctl start instance|DB状态由offline变为online||
||4、YCS备节点、DB备节点，执行 ycsctl stop instance|DB状态变为offline，并且DB主节点保持不变||
||以上操作后，执行ycsctl start instance|DB状态由offline变为online||
|ycs启停|1、YCS主节点、DB主节点，执行 ycsctl stop ycs|YCS、DB状态变为offline，并且YCS、DB成功选出新的主节点|  
|
||以上操作后，执行ycsctl start ycs|YCS、DB状态由offline变为online||
||2、YCS主节点、DB备节点，执行 ycsctl stop ycs|YCS、DB状态变为offline，并且DB主节点保持不变，YCS成功选出新的主节点||
||以上操作后，执行ycsctl start ycs|YCS、DB状态由offline变为online||
||3、YCS备节点、DB主节点，执行 ycsctl stop ycs|YCS、DB状态变为offline，并且DB成功选出新的主节点，YCS主节点保持不变||
||以上操作后，执行ycsctl start ycs|YCS、DB状态由offline变为online||
||4、YCS备节点、DB备节点，执行 ycsctl stop ycs|YCS、DB状态变为offline，并且YCS、DB主节点保持不变||
||以上操作后，执行ycsctl start ycs|YCS、DB状态由offline变为online||
||5、auto_start=always一个实例两个会话，一个执行stop ycs,一个执行start ycs并发操作|ycs start应该能成功||


  


# **六.**  ** **  **测试框架**

guider。

# **七.**  ** **  **测试环境说明**

  


## Attachments:

[YCS支持强制停止测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2M4OTcwYzJhZjRmNTFmYTkzIiwicmVmX2lkIjoiNjczOTY5Y2M3MjgyMDZlZmI5MmVmNzc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDE5LCJleHAiOjE3ODIyOTU0MTl9.mVhyKsceprxL_Eg1-PNlVOVBz1RAq8wlIKfUVCdbs_w)

 (application/x-xmind)    


## Comments:

|  [](null)  ,质量加固：    [YCS强制启停质量加固](https://conf.yasdb.com/pages/viewpage.action?pageId=144144142)  ,Posted by xufanbo at 三月 05, 2024 14:48|
|---|
|  [](null)  ,一、会议时间：2023/12/26 周二10：30-11:00    
  二、会议地点：线上会议    
  三、会议主持人：徐凡博    
  四、参会人员：李垠、陈俊杰、张丽红、徐凡博    
  五、会议主题：【YDBRD-15229】【共享集群】YCS支持强制停止--质量加固测试,会议纪要：    
  1、目前框架默认值均为90，除并发框架为0外。 ---可再确认一下    
  2、可以通过调整buffer来卡reform时间。    
  3、主要关注默认值在并发场景和故障场景下的表现，故障已有自动化看护，并发此次已有新的用例设计看护,加固测试设计文档：    
    [--https://conf.yasdb.com/pages/viewpage.action?pageId=144144142](null)  ,Posted by xufanbo at 三月 06, 2024 11:11|
