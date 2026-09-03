Created by 李雪峰, last modified by  李垠 on 十一月 08, 2024

SR:     [YDBRD-13476](https://jira.yasdb.com/browse/YDBRD-13476?src=confmacro)    -  【共享集群】YASDB加入退出YCS流程  完成

SR:    [YDBRD-13472](https://jira.yasdb.com/browse/YDBRD-13472?src=confmacro)    -  【共享集群】YFS加入退出YCS流程  完成

##   [1.Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

资源启停是根据资源配置进行启动、停止资源。在资源运行过程中监测资源实时状态，当监测到实时状态与目标状态不符，做相应操作使之达成目标状态。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

- 启动资源：在ycs系统启动时，或在监控时根据需要启动资源，并使加入到系统topo；
- 停止资源：在ycs系统停止时，或在监控时根据需要停止资源，并使加入到系统topo中；


  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

YFS只会跟节点同时起停，不提供客户端操作命令。

命令参考：    [【YCS】启停节点，启停资源，以及查询拓扑状态设计文档](109593977.html)  

- ycsctl start instance 
- ycsctl stop instance 


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- 每个资源总量不超过64个
- YFS的主节点与YCS的主节点是同一节点
- 支持正常启停和主备切换
- yasdb不支持并发启停


##   [5. Detail Design（详细计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  



  


如果资源已停止，但YCS未停止，这时再有该资源的消息过来，该消息由已停止的资源来回复。

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

typedef struct StResourceItem {    
  SpinLock lock;                                            //会同时在监控线程和主线程操作，需要lock保护    
  CodBool isEmbedded;                              //在stop 时，如果是嵌入式资源还需要关闭动态库    
  volatile CodBool init;                               //创建和销毁时设置    
  volatile CodBool inProcess;                    //获取资源进行处理设置，保证一个资源只有一个线程在处理。同一个资源多个命令到达时，会串行处理每个命令。    
  volatile CodUint8 stat;                          //YCS_STAT_OFFLINE = 0, YCS_STAT_ONLINE = 1    
  YcsContext context;                             //YCS调用上下文    
  YcsMonitor monitor;                           //监控线程

// for embedded resource    
  CodPointer handler;                                        // yfs dll handler     
  YcsStartResource startCb;                              //yfs dll 启动接口    
  YcsStopResource stopCb;                             //yfs dll 停止接口    
  YcsMonitorResource monitorCb;                //yfs dll 监控接口

// for ipc resource    
  CodChar* startShell;                                 //YasDB启动脚本路径    
  CodChar* stopShell;                                //YasDB停止脚本路径    
  CodThread startThread;     
  CodThread stopThread;     
  CodThread thread;                                   //处理资源操作请求的线程     
  ResourceIpc ipc;     
  volatile CodUint64 recvTicks;                  // ticks of the last packet recv    
  } ResourceItem;

  


  






  








  


  


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

不涉及

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx%E8%AE%BE%E8%AE%A1)  

每次topo结构变更都会将其打印在日志中

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

###   [6.1 节点正常启停](https://conf.yasdb.com/pages/viewpage.action?pageId=109584076#62-%E8%8A%82%E7%82%B9%E6%AD%A3%E5%B8%B8%E5%90%AF%E5%81%9C)  

|用例场景|预期|备注|
|:---|:---|:---|
|单节点启动，配置参数AUTO_START=NEVER|正常启动，YFS启动，yasDB不启动|  
|
|单节点启动，配置参数AUTO_START=NEVER，启动正常后，启动数据库|数据库正常启动，业务能进行|  
|
|单节点数据正常运行，停止数据库，再启动|数据库正常启动，业务能进行|  
|
|2节点、配置参数AUTO_START=NEVER|正常启动，YFS启动，yasDB不启动|  
|
|2节点、配置参数AUTO_START=NEVER，启动正常后，启动数据库|数据库正常启动，业务能进行|  
|
|2节点数据正常运行，停止备数据库|不影响主数据对外提供服务|  
|
|2节点数据正常运行，重启备数据库|不影响主数据对外提供服务|  
|
|2节点数据正常运行，停止主数据库|已停主不再提供服务，另一个数据库变为主，能正常提供服务|  
|
|2节点数据正常运行，重启主数据库|不影响主数据对外提供服务|  
|
|2节点数据正常运行，停止备节点|主节点正常提供服务|  
|
|2节点数据正常运行，重启备节点|不影响主数据对外提供服务|  
|
|2节点数据正常运行，停止主节点|另一个节点变为主节点，能正常提供服务|  
|
|2节点数据正常运行，重启主节点|不影响主数据对外提供服务|  
|


###   [6.2 节点异常启停](https://conf.yasdb.com/pages/viewpage.action?pageId=109584076#63-%E8%8A%82%E7%82%B9%E5%BC%82%E5%B8%B8%E5%90%AF%E5%81%9C)  

|用例场景|预期|备注|
|:---|:---|:---|
|单节点启动，yfs启动不成功|启动报错，输出错误日志, ycs节点状态正确|  
|
|单节点启动，yasDB参数配置错误，启动不成功|启动报错，输出错误日志，yfs,ycs节点状态正确|  
|


###   [6.3 节点并发启停](https://conf.yasdb.com/pages/viewpage.action?pageId=109584076#64-%E8%8A%82%E7%82%B9%E5%B9%B6%E5%8F%91%E5%90%AF%E5%81%9C)  

节点只带YFS启停，不包含YasDB

|用例场景|预期|备注|
|:---|:---|:---|
|2节点，首次启动，同时拉起两节点|没有报错，最终为一主一备形态，查询topo信息正常|  
|
|2节点，集群正常运行后，同时停下两节点后拉起|没有报错，最终为一主一备形态，查询topo信息正常|  
|
|2节点，集群正常运行后，停下备节点，再同时拉起原备节点和停下主节点|没有报错，最终为一主一备形态，查询topo信息正常|  
|
|2节点，集群正常运行后，反复分别启停两个节点|没有报错，最终为一主一备形态，查询topo信息正常|  
|


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

- 数据库实例启停   2人天
- YFS启停  4人天


  


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


## Attachments:

[image2023-4-26_11-42-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTVhMWFkOWEzMzExZGM3ZmQ3IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.rY2IqeYsAYt14liDxH00UeVwOfLi0mnt-gGHnpzmfcE)

 (image/png)    


[image2023-4-26_11-41-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTU4OTcwYzJhZjRmNTIwMTYxIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.X1tz_O-b92w43XTPcXPv-OTCMqptkxrqpVPt8SBSntQ)

 (image/png)    


[image2023-4-26_11-37-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTVhMWFkOWEzMzExZGM3ZmQ4IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.DIO-wHSvI3ng1Zo9Nx94uEI_FXeNjLAsCNiAUIpQLTE)

 (image/png)    


[image2023-4-26_11-34-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTU4OTcwYzJhZjRmNTIwMTYyIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.4YBLZHbnL6witlveYFJkjnlUEUpNhv0FKEWScBktOnI)

 (image/png)    


[image2023-4-26_11-21-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTU4OTcwYzJhZjRmNTIwMTYzIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.TKUFF2MQvd1Um3SB85cmYXxv1YnbptpFCHCUtG5yuyg)

 (image/png)    


[image2023-4-25_17-38-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTVhMWFkOWEzMzExZGM3ZmQ5IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.VvcshT3kFYcnc6-bXeNUykGDZqlfuuCOEWqWNi_8RnM)

 (image/png)    


[image2023-4-25_14-37-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTVhMWFkOWEzMzExZGM3ZmRhIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.rIwvpjA3w3r9uvZmtqDQllcprmaFr_aJSbnRMBqTLXk)

 (image/png)    


[image2023-4-25_14-32-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTVhMWFkOWEzMzExZGM3ZmRjIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.L1cEsyUZnLJkBlIkobiIWD6t0ecKXq1RrVfTosXCpMM)

 (image/png)    


[image2023-4-25_10-44-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTU4OTcwYzJhZjRmNTIwMTY3IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.a1BREWoYeZINrCyeCNeT4ATnnON_XfllIZ8R7b6xCGQ)

 (image/png)    


[image2023-4-25_10-26-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTY4OTcwYzJhZjRmNTIwMTY5IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.HR6CGUwtM1uO54U-D616KixEfgo9INQv1p7lxQkeRsQ)

 (image/png)    


[image2023-4-24_21-7-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTZhMWFkOWEzMzExZGM3ZmRlIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.cz55nSarjHC6JMonLCbdgf5_Z-yAyCjbUePT_m24bbA)

 (image/png)    


[image2023-4-24_20-37-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTY4OTcwYzJhZjRmNTIwMTZhIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.qP4qtOVvgC2ThcIAvWApeVxtnsiUjp7nOp9rSfGdyDs)

 (image/png)    


[image2023-4-24_20-29-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTZhMWFkOWEzMzExZGM3ZmUxIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.e2CJXJjmzhr_qS0GdjmYKHrAa7yC8ati0WHpmTRM1G8)

 (image/png)    


[image2023-4-24_19-23-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTZhMWFkOWEzMzExZGM3ZmUyIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.YStRduaaQ9OtG7xWOoy9ipa0ASif3hyvEgRPB5gy3ds)

 (image/png)    


[image2023-4-24_18-46-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTY4OTcwYzJhZjRmNTIwMTZjIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.doawVuWGpN897nr5txTwDJfadFb8bJrjUIa1z5w6nRs)

 (image/png)    


[image2023-4-24_17-1-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTZhMWFkOWEzMzExZGM3ZmU0IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.I4Y6b2pL6ePDZHZciki91fZm2g7maTceuLy4ZgL31GI)

 (image/png)    


[image2023-4-23_20-4-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTZhMWFkOWEzMzExZGM3ZmU1IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.R_PJ2cLCI7112vzjzjDlRplGLCS-HCN5dV0n0MQaSN4)

 (image/png)    


[image2023-5-9_11-40-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTZhMWFkOWEzMzExZGM3ZmU2IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.fjdHI77pau1u7z8RQX84l4MA7yYgyOx7nqAlzAENLhI)

 (image/png)    


[resource_architecture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTY4OTcwYzJhZjRmNTIwMTcxIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.fMiNsPoUcwtgpXuflcJBWGZtreoWpOf6kGoWweXZXq4)

 (image/png)    


[res_主实例启动.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTZhMWFkOWEzMzExZGM3ZmU4IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.jdoSqBe99Yysd4ui-rURzvJAH_uxOObxYy9xbwqIv3U)

 (image/png)    


[res_非主实例启动流程.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTZhMWFkOWEzMzExZGM3ZmU5IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.BtVBXWvQZ4V5i5xde0U45HF5qIT3RxQXj8A_ahyWzCQ)

 (image/png)    


[res_主实例启动.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTY4OTcwYzJhZjRmNTIwMTczIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.1FZz9PC_X8e8nQmZcHq3H5ZB5Aupju7s2tlZUOOWCMI)

 (image/png)    


[res_非主实例启动流程.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTZhMWFkOWEzMzExZGM3ZmVhIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.zNNLM_oGv98reT2ymIC1oMiqaoKh6TZ_ERRVCO5WKbM)

 (image/png)    


[res_非主实例启动流程.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTZhMWFkOWEzMzExZGM3ZmViIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.n5qhIq31FokjESIYz3dfSWSXmtr2FsLJ035aJFNV9FE)

 (image/png)    


[res_主实例停止.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTY4OTcwYzJhZjRmNTIwMTc3IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.H-QiyoqZppRJFKOGX2FCMt5Iagnw_F30pofHo6JJZ2s)

 (image/png)    


[res_非主实例停止流程.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTY4OTcwYzJhZjRmNTIwMTc4IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.Q5MMD7X7Muw-fxvw8A8prvuKGrw5UK7k6VrnuQP6wXI)

 (image/png)    


[yfs启停(2).jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTZhMWFkOWEzMzExZGM3ZmVmIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.hQgfiTRr-HavrKq81V_ieBWPvGMzzYarCpxBGk1SvXY)

 (image/jpeg)    


[资源主实例启动.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTZhMWFkOWEzMzExZGM3ZmYwIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.N3vNPfR484TBbdI0CpahF_obcVK9HEBJFNdBIqslEzA)

 (image/png)    


[资源非主实例启动.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTY4OTcwYzJhZjRmNTIwMTdiIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.sHjkNHAlZYTIVwlSsvQT0cZYZIgrrs2aydV9X-8EHnc)

 (image/png)    


[资源主实例停止.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTdhMWFkOWEzMzExZGM3ZmYxIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.gEu007v4RhNNRo5nV5Wo1B8b4MpYZwip9CLGpM46Trc)

 (image/png)    


[资源非主实例停止.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTc4OTcwYzJhZjRmNTIwMTdkIiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.irdcXiofc7SnrHozp4hfXL-RcamFMmrTWJhGrfBeIpM)

 (image/png)    


[resource_architecture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTdhMWFkOWEzMzExZGM3ZmY0IiwicmVmX2lkIjoiNjczOTZiMTU1OTNmOTljOWZmMjM1ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODUxLCJleHAiOjE3ODIzNzcyNTF9.HPlJBTvxZUX4auPW5kECp8ncr5VEE79PS0nbRpeOlm8)

 (image/png)    
