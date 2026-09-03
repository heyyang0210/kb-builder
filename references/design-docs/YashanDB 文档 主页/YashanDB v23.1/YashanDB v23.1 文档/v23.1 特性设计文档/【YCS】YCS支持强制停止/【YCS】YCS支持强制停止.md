Created by 李雪峰, last modified by  李垠 on 十一月 08, 2024

  [YDBRD-15229](https://jira.yasdb.com/browse/YDBRD-15229?src=confmacro)    -  【共享集群】YCS支持强制停止  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#1-overview%E6%A6%82%E8%BF%B0)  

 当正常的停止命令无法停止DB时， 而用户又想立即停止DB。强制停止功能通过发送SIGKILL信号使DB进程强制退出。

停止脚本不使用密码，而是将操作者设置  YASDBA用户组成员，通过yasql登录数据库，执行shutdown   。

参考：    [操作系统认证管理](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E4%BA%A7%E5%93%81%E5%AE%89%E5%85%A8/%E7%94%A8%E6%88%B7%E5%8F%8A%E8%AE%A4%E8%AF%81/%E6%93%8D%E4%BD%9C%E7%B3%BB%E7%BB%9F%E8%AE%A4%E8%AF%81%E7%AE%A1%E7%90%86/00%E6%93%8D%E4%BD%9C%E7%B3%BB%E7%BB%9F%E8%AE%A4%E8%AF%81%E7%AE%A1%E7%90%86.html)  

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. 停止DB过程中实现强制停止DB；
1. 停止结点实现停止结点
1. 停止脚本不使用密码；
1. YCS监测到DB异常停止后更新相应状态和topo结构。


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#3-interfaces%E6%8E%A5%E5%8F%A3)  

//停止DB    
  ycsctl stop instance     
    
  //停止结点    
  ycsctl stop ycs 

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1. DB在线恢复还没做，强制停止DB，再重新启动可能会有异常
1. 停止结点过程中，YCS 自身或是YFS卡住，需要手动杀YCS进程
1. 无密码停止脚本，操作系统用户需是  YASDBA用户组成员


注意：uds文件所在的路径： ${YASDB_DATA}/instance/yasdb.ipc。需要正确配置好相应环境变量。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

强制停止DB，就向DB的进程发送SIGKILL信号(kill -9)。DB的进程号是通过DB在的握手协议里传给YCS。

在停止DB时，先执行正常停止命令，再执行强制停止。通过参数控制如何执行强制停止。具体实现如下：

通过参数WAIT_STOP_FIN_TIME（等待正常停止结束时间）控制强制停止的执行，范围设置在[0, 300] 秒。    
  WAIT_STOP_FIN_TIME=0                  表示永远不执行强制停止，一直等待正常停止结束    
  0 < WAIT_STOP_FIN_TIME <= 300  表示在WAIT_STOP_FIN_TIME时间之后数据库未停止，则执行强制停止     
  WAIT_STOP_FIN_TIME                      默认值设置为90秒

###   [5.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)      [Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0b8970c2af4f520104/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUNBQUFBQUFBQWdBSUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFnQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2NDMsImV4cCI6MTc4MjMwMTQ0M30.HKZdcfILwfdcjTUSvtCbmBETiemEMDcjQU9nIIOtEj8)

```


```

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

//资源上下文

typedef struct StYcsContext {

        ......

       CodUint32 resPid;   // DB进程号， 记录在每个资源的上下文中

       ......

} YcsContext;

#####   [5.2.1 获取DB进程号 ](https://conf.yasdb.com/pages/viewpage.action?pageId=109584076#5221-%E5%88%9D%E5%A7%8B%E5%8C%96ycs%E5%90%84%E4%B8%AA%E6%A8%A1%E5%9D%97%E8%B5%84%E6%BA%90)  

  ``  

#####   [5.2.2 强制停止DB](https://conf.yasdb.com/pages/viewpage.action?pageId=109584076#5221-%E5%88%9D%E5%A7%8B%E5%8C%96ycs%E5%90%84%E4%B8%AA%E6%A8%A1%E5%9D%97%E8%B5%84%E6%BA%90)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0ba1ad9a3311dc7f7c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUNBQUFBQUFBQWdBSUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFnQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2NDMsImV4cCI6MTc4MjMwMTQ0M30.HKZdcfILwfdcjTUSvtCbmBETiemEMDcjQU9nIIOtEj8)

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|场景|预期|
|---|---|
|3结点，YCS主结点，DB主结点: ycsctl stop instance |DB结点状态从上线变成下线, 且DB成功选出新主|
|3结点，YCS备结点，DB备结点: ycsctl stop instance |DB结点状态从上线变成下线, DB主结点保持不变|
|3结点，YCS主，DB备: ycsctl stop instance |DB结点状态从上线变成下线,  DB主结点保持不变|
|3结点，YCS备，DB主: ycsctl stop instance |DB结点状态从上线变成下线,  且DB成功选出新主|
|3结点，YCS主结点，DB主结点: ycsctl stop ycs |DB、YCS结点状态从上线变成下线，且DB、YCS成功选出新主|
|3结点，YCS备结点，DB备结点: ycsctl stop ycs |DB、YCS结点状态从上线变成下线, DB、YCS主结点保持不变|
|3结点，YCS主，DB备: ycsctl stop ycs |DB、YCS结点状态从上线变成下线,  DB主结点保持不变，YCS换新主|
|3结点，YCS备，DB主: ycsctl stop ycs |DB、YCS结点状态从上线变成下线,  且DB成功选出新主|
|3结点，设置参数WAIT_STOP_FIN_TIME=0，停止DB |当无法停止DB时，会一直等待|
|3结点，不设置参数WAIT_STOP_FIN_TIME，停止DB |当无法停止DB时，等待90秒后，强制停止DB成功|
|3结点，不设置参数WAIT_STOP_FIN_TIME=20，停止DB |当无法停止DB时，等待20秒后，强制停止DB成功|
|3结点：,1、设置ycs配置文件配置项：AUTO_START=NEVER,,2、通过命令启动DB: ycsctl start instance,3、将通过shell 命令 kill -9 DB进程号，将DB进程终结|DB结点状态从上线变成下线, 再次直接执行ycsctl start instance，也能正常启动|


  


##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#7-document%E8%B5%84%E6%96%99)  

     命令字说明文档

##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

  


##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  




## Attachments:

[image2023-6-30_16-25-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDlhMWFkOWEzMzExZGM3ZjVmIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.es9m-fMI_s55Lsob0ap7owq0Z4TRpCiG4tfaATwkEPQ)

 (image/png)    


[image2023-6-29_17-52-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDlhMWFkOWEzMzExZGM3ZjYwIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.RpvvISkit_pGMZNM4aUZ06hjPfaJ0arGBV59i1gwrx8)

 (image/png)    


[image2023-6-29_17-51-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDk4OTcwYzJhZjRmNTIwMGViIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.rWB0REp5-MuQ5xRUctS7T5fuCVpSl3k9lM36-alBius)

 (image/png)    


[image2023-6-29_17-50-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGFhMWFkOWEzMzExZGM3ZjYxIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.RMLsu3xo_mz88_eaVZhZVH-GKLzMFOybNEGXkXv646w)

 (image/png)    


[image2023-6-29_17-50-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGE4OTcwYzJhZjRmNTIwMGVkIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.36GSPZpIdKMRqQxidtLoZtbdYK-igD6W7XRU3vTAr84)

 (image/png)    


[image2023-6-29_17-46-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGFhMWFkOWEzMzExZGM3ZjYyIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.kNQxi_Sx7BNm9Z21x2eX8XEmYLYhh5eoFzMOc65b0Wg)

 (image/png)    


[image2023-6-29_17-46-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGFhMWFkOWEzMzExZGM3ZjYzIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.1V1_xebGEluoEc_mGk0OaAzfBGpLCwBx2-_BQv_pDII)

 (image/png)    


[image2023-6-29_17-38-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGFhMWFkOWEzMzExZGM3ZjY2IiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.xL0_IJvZ3v1LyDwDiGM5qyQpi2ZUtbz9Gt-5MscCVqo)

 (image/png)    


[image2023-6-29_17-37-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGE4OTcwYzJhZjRmNTIwMGVmIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.vrRYeZGmEpKlcZOyel3N5PjMeMssUbl6sTUSZk14W5w)

 (image/png)    


[image2023-6-29_17-35-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGE4OTcwYzJhZjRmNTIwMGYxIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.BBKZxzxkWMwrNrrQ2VSRV44eBoUShlQqE7SoYtHtcs8)

 (image/png)    


[image2023-6-29_17-35-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGE4OTcwYzJhZjRmNTIwMGYyIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.1S4kxtZNMHb6TvCe1wAU2S1WFBNz5ZK4-MNG9aaM75U)

 (image/png)    


[image2023-6-29_14-14-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGFhMWFkOWEzMzExZGM3ZjY4IiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.fUnEKGzlfFEps2F2nsICp0bmfjw2BGhVHZuTBHQg0DI)

 (image/png)    


[image2023-6-29_14-12-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGFhMWFkOWEzMzExZGM3ZjZhIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.S_y3zmaEv8VTYbtHDazeBGAZi1CY2X4iw4QZfF9aJxU)

 (image/png)    


[image2023-6-29_14-12-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGFhMWFkOWEzMzExZGM3ZjZiIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.tIVKaE2Q0YCSpLTHBJXs8s8DJH7MjUucdft0RkuIOiw)

 (image/png)    


[image2023-6-29_14-11-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGFhMWFkOWEzMzExZGM3ZjZkIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.peaDWts24j2w3rDrmwtS7tlc6jmVgI9HJUzFewfZ_ds)

 (image/png)    


[image2023-6-29_11-16-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGFhMWFkOWEzMzExZGM3ZjZlIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.w30nCiAB_TQiGppwd7Xaq-B7c4_3teQiRYaRXBYsnwE)

 (image/png)    


[image2023-6-28_21-17-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGFhMWFkOWEzMzExZGM3ZjZmIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.i6nHzpWlVdzxOCLSxzLhGaQccKu2pi22-3FpFntrtaE)

 (image/png)    


[image2023-6-28_21-12-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGE4OTcwYzJhZjRmNTIwMGY4IiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.QGYFN79D1u8_zIqYQkXSE7ubgaxQam-RmkV_OLQMTH8)

 (image/png)    


[image2023-6-28_21-10-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGFhMWFkOWEzMzExZGM3ZjcwIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.Y_FBWUz0CcSIHEbeNtqKVyKfSuDQJTjPtA1z-gc4OFM)

 (image/png)    


[image2023-6-28_21-9-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGFhMWFkOWEzMzExZGM3ZjcyIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.TegC6Pap0hIZdHIwkd4_xt8xMuvvSZvCW5Db_IZoGTY)

 (image/png)    


[image2023-6-28_21-8-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGI4OTcwYzJhZjRmNTIwMGZjIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.cd1ByHlHWkFQAn-wp6dudDNLkvtkbrgUrM6CHz7azSA)

 (image/png)    


[image2023-6-28_20-42-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGI4OTcwYzJhZjRmNTIwMGZkIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.D2U5yPBg7okAArqBRBgYGbjJDdFdC1IhRcw2nDGciFo)

 (image/png)    


[image2023-6-28_20-1-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGJhMWFkOWEzMzExZGM3Zjc0IiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.Volh4IQdaU_tr5F0ns8whmSyv0JZ8v6LLeqMasooNsI)

 (image/png)    


[image2023-6-28_19-54-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGI4OTcwYzJhZjRmNTIwMTAwIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.342zl1JJ_DbY7clsyBBe8XL7_LlHvWkWKARdDnZXjhk)

 (image/png)    


[image2023-7-10_20-18-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGI4OTcwYzJhZjRmNTIwMTAxIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.PGFdGNjnnTAaTPY6SDVLIDiaUP4HZI99bXP2Gth6oko)

 (image/png)    


[image2023-7-10_20-39-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGJhMWFkOWEzMzExZGM3Zjc2IiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.gwYTtqaAjFl0qe-Qi9EYlXgIx_voqbbw4n46y90--5U)

 (image/png)    


[image2023-7-10_20-54-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGI4OTcwYzJhZjRmNTIwMTAyIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.h-SskWzXz9tO9nXAkMz5JGyKegewvi620q-ouGXfXN4)

 (image/png)    


[image2023-7-10_21-25-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGJhMWFkOWEzMzExZGM3Zjc5IiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.173aQrTXaDXsuMpgfbU78KAou5HYgYTmfQEmuEelaW4)

 (image/png)    


[image2023-7-13_10-5-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGJhMWFkOWEzMzExZGM3ZjdhIiwicmVmX2lkIjoiNjczOTZiMDk3MjgyMDZlZmI5MmYwMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQzLCJleHAiOjE3ODIzNzcwNDN9.RHRln3pimuXFQcMUWHP2dxXXpXukEVDULeky7X-h_a8)

 (image/png)    
