Created by 张鹏飞, last modified on 六月 14, 2024

  


##   [1. 总述](#1-总述)  

本需求主要解决通过MySQL Plugin Service方式连接到数据库的会话管理问题。目标是可以像管理YashanDB的会话一样，管理MySQL的会话。

###   [1.1 需求来源](#11-需求来源)  

####   [1.1.1 MySQL Plugin Service线程管理](#111-mysql-plugin-service线程管理)  

  [Plugin Service线程管理](https://conf.yasdb.com/pages/viewpage.action?pageId=150625724#412-plugin-service%E7%BA%BF%E7%A8%8B%E7%AE%A1%E7%90%86)  

用户发起的MySQL连接请求到达服务线程后，服务线程会为连接请求分配一个工作线程，用于处理该连接的后续请求。

线程与用户连接的关系分为独占模式和共享模式（线程池）。本SR只支持独占模式，即每个连接独占一个线程。

####   [1.1.2 MySQL Plugin Service会话管理](#112-mysql-plugin-service会话管理)  

  [会话管理](https://conf.yasdb.com/pages/viewpage.action?pageId=150625724#413-%E4%BC%9A%E8%AF%9D%E7%AE%A1%E7%90%86)  

- 通过v$session等视图查看会话状态。
- kill session。本特性不影响kill session。
- MySQL和YashanDB使用的是同一套SQL Handler资源，因此可以通过设置最大连接数，限制YashanDB会话和MySQL会话的总数。


###   [1.2 调研文档](#12-调研文档)  

无

###   [1.3 需求分析](#13-需求分析)  

####   [1.3.1 YashanDB会话管理模式](#131-yashandb会话管理模式)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ea0a1ad9a3311dc9852/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQkVBQUFBQUFBQUFnQUFBQWdBQUFBQUFBQUFBQUFBQUFDQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFJQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBRUFBQUFFQUFBQUFBQUlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg0MzcsImV4cCI6MTc4MjQ0OTIzN30.lnTgin68AiTd2FJaxqCgH-3WdpVsgj2JtD8OXj3v7yk)

YashanDB模式的特点：

- AniWorker相当于工作线程的载体，Worker中包含了会话在活跃时需要使用的资源（线程、栈内存、packet等）。
- AniWorker后的AnrWorkerContext中记录了执行态的程序栈等信息，可用于栈保护。
- SQL Handler是SQL命令执行的句柄，并行执行的SQL可能会占用多个SQL Handler。
- AnrSession代表会话（或连接），它是服务端记录会话信息的载体，包括客户端的连接信息，以及该会话执行SQL命令的句柄。
- 独占模式的线程与会话绑定，共享模式下，AnrSession与Worker只在会话活跃时动态关联。


####   [1.3.2 现有MySQL会话管理模式](#132-现有mysql会话管理模式)  

![现有MySQL会话管理模式]  )

- MySQL Plugin Service相当于第三方代码，由于会话信息记录在YsmyWorker上，内核代码难以访问会话信息。
- Session和Worker的概念统一，后续无法做共享模式。
- 缺乏栈保护机制


####   [1.3.3 本特性MySQL会话管理模式](#133-本特性mysql会话管理模式)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ea08970c2af4f5219e0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQkVBQUFBQUFBQUFnQUFBQWdBQUFBQUFBQUFBQUFBQUFDQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFJQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBRUFBQUFFQUFBQUFBQUlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg0MzcsImV4cCI6MTc4MjQ0OTIzN30.lnTgin68AiTd2FJaxqCgH-3WdpVsgj2JtD8OXj3v7yk)

本特性将现有MySQL会话管理模式修改为与YashanDB会话管理模式一致的架构。内核无需区分会话的类型是YashanDB还是MySQL，都可以用统一的接口访问会话信息。

##   [2. 接口](#2-接口)  

无

##   [3. 规格与约束](#3-规格与约束)  

仅支持独占模式。即无论YashanDB实例配置的是独占模式还是共享模式，MySQL只用独占模式。

##   [4. 特性](#4-特性)  

###   [4.1 MySQL Session分配](#41-mysql-session分配)  

与YashanDB会话一致，分配会话时会分配AnrSession。返回AnlHandler

接口：CodResult lcbCreatePluginSession(CodPointer link, CodPointer* pSession)

###   [4.2 Worker分配及初始化](#42-worker分配及初始化)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ea0a1ad9a3311dc9853/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQkVBQUFBQUFBQUFnQUFBQWdBQUFBQUFBQUFBQUFBQUFDQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFJQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBRUFBQUFFQUFBQUFBQUlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg0MzcsImV4cCI6MTc4MjQ0OTIzN30.lnTgin68AiTd2FJaxqCgH-3WdpVsgj2JtD8OXj3v7yk)

分配AniWorker时，会同时分配worker stack。

分配YsmyWorker时，在AniWorker的worker stack的size上加上YsmyWorker，将分配到的内存worker stack拆解成worker stack和YsmyWorker。这样可通过内存偏移来完全YsmyWorker和AniWorker的转换。

接口：

- CodUint64 lcbGetAnrWorkerSize()，获取AniWorker实际大小。 AniWorker = YsmyWorker  - lcbGetAnrWorkerSize(); YsmyWorker = AniWorker + lcbGetAnrWorkerSize();
- lcbAttachHandler(AniWorker* worker, CodChar* threadBegin, CodUint32 threadStackSize, AnlHandler* handler)。关联worker与AnlHandler，包括初始化AnrWorkerContext；


###   [4.3 连接信息回填](#43-连接信息回填)  

MySQL登录报文中会包含客户端的一些连接信息，在完成登录后，需要将其中部分信息记录在会话上。包括客户端程序名称、客户端操作系统用户、登录数据库的用户。

接口：lcbSetSessionClientInfo(CodPointer anrSession, const CodText* dbUser, const CodText* osUser, const CodText* program)。

规格：由于MySQL协议不会向服务端发送客户端主机名，因此V$session中不会显示客户端主机名。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. 通过v$session等视图查看会话状态。需要关注客户端信息是否正确显示。
1. syscontext可查询客户端程序名称、客户端操作系统用户、登录数据库的用户。


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[lexRead.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOWY4OTcwYzJhZjRmNTIxOWQ5IiwicmVmX2lkIjoiNjczOTZlOWY1OTNmOTljOWZmMjM4NmQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NDM3LCJleHAiOjE3ODI1MjQ4Mzd9.hOF13D99zMZA13BlKGjogZxjJ7q08vFfYaeIHmOpIEs)

 (image/png)    


[parse.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOWZhMWFkOWEzMzExZGM5ODRiIiwicmVmX2lkIjoiNjczOTZlOWY1OTNmOTljOWZmMjM4NmQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NDM3LCJleHAiOjE3ODI1MjQ4Mzd9.EHm6WJjVi0xNi3f9ZgKRS4SpNtzhHG5lTw0QZYr555E)

 (image/png)    


[plugin_service_regsiter.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOWY4OTcwYzJhZjRmNTIxOWRhIiwicmVmX2lkIjoiNjczOTZlOWY1OTNmOTljOWZmMjM4NmQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NDM3LCJleHAiOjE3ODI1MjQ4Mzd9.yG8ksJaYpcn6b47cSmcyA7VucRlpFA9UagN70ifhI6M)

 (image/png)    


[崖山模式.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOWY4OTcwYzJhZjRmNTIxOWRiIiwicmVmX2lkIjoiNjczOTZlOWY1OTNmOTljOWZmMjM4NmQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NDM3LCJleHAiOjE3ODI1MjQ4Mzd9.m-z-AwSxmvVGnsTtxyN81Pl_RbAjRgXB5_mV1a7b0fo)

 (image/png)    


[MySQL现有模式.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTBhMWFkOWEzMzExZGM5ODRjIiwicmVmX2lkIjoiNjczOTZlOWY1OTNmOTljOWZmMjM4NmQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NDM3LCJleHAiOjE3ODI1MjQ4Mzd9.n_OGe3nQo_CkI97JFyGfoJP1u2PiLVWCDs3Ytbu2a6U)

 (image/png)    


[MySQL新模式.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTA4OTcwYzJhZjRmNTIxOWRkIiwicmVmX2lkIjoiNjczOTZlOWY1OTNmOTljOWZmMjM4NmQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NDM3LCJleHAiOjE3ODI1MjQ4Mzd9.MYvlj50_d2aljjalxOaraIPVEtCE0E-7S1thkK2tNaI)

 (image/png)    


[MySQL现有模式.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTBhMWFkOWEzMzExZGM5ODRmIiwicmVmX2lkIjoiNjczOTZlOWY1OTNmOTljOWZmMjM4NmQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NDM3LCJleHAiOjE3ODI1MjQ4Mzd9.XBO6tyFNXuAYcMRYjK56gxeI9z7O3Xv-ii7sP9cbOjY)

 (image/png)    


[YsmyWorker.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTA4OTcwYzJhZjRmNTIxOWRlIiwicmVmX2lkIjoiNjczOTZlOWY1OTNmOTljOWZmMjM4NmQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NDM3LCJleHAiOjE3ODI1MjQ4Mzd9._tPhj9413vhA8cIzH2e74PTjtL0Q0ItQVmJoEJmfyEg)

 (image/png)    


[MySQL新模式.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTBhMWFkOWEzMzExZGM5ODUxIiwicmVmX2lkIjoiNjczOTZlOWY1OTNmOTljOWZmMjM4NmQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NDM3LCJleHAiOjE3ODI1MjQ4Mzd9.dILRrbxp60LnU3vwvVn-CJTRjWii65V_LQnH3TIlOcw)

 (image/png)    
