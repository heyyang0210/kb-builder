Created by 马志宏, last modified by  高亚宁 on 七月 19, 2023

## 1. Overview（概述）

      提供流式备份接口，对接鼎甲等第三方备份软件

### 友商方案调研

1. Oracle提供了一系列SBT API接口规范，由第三方备份厂商实现接口，编译为so动态库，rman的备份语法中通过SBT_LIBRARY指定动态库的加载路径。

执行备份时，数据库的server session调用SBT API进行流式备份，即数据库侧调用API

```
RMAN> configure channel device type 'sbt_tape' parms="SBT_LIBRARY=oracle.disksbt, ENV=(backup_dir=/tmp/backup)";
```

  


![](https://pingcode.yasdb.com/atlas/files/public/6739693fa1ad9a3311dc753e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

![](https://pingcode.yasdb.com/atlas/files/public/6739693f8970c2af4f51f6c9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

  


![](https://pingcode.yasdb.com/atlas/files/public/6739693fa1ad9a3311dc753f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

2.达梦也是定义了一系列SBT API接口，接口名与oracle类似

3.GaussDB使用XBSA接口实现NBU备份，它通过Roach client来间接的和第三方备份软件交互

![](https://pingcode.yasdb.com/atlas/files/public/6739693fa1ad9a3311dc7540/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

## 2. yashanDB备份流程

![](https://pingcode.yasdb.com/atlas/files/public/6739693f8970c2af4f51f6ca/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

yashanDB执行本地备份的流程图大致如上：

1. 根据配置的并行度，数据库启动多个后台线程；
1. 主线程分配备份任务给每个后台线程，每个后台线程可能备份DB的一个完整文件或者一个文件分片，生成一个独立的备份文件


  


我们目前也实现基于tcp的远程备份，不过是通过工具作为接收端实现的

![](https://pingcode.yasdb.com/atlas/files/public/6739693f8970c2af4f51f6cb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

## 3. 流式备份  接口

   yashanDB目前没有对外的流式备份接口，主要是对接方案暂不明确。目前我们实现了基于tcp的远程备份，架构

参考友商的接口实现，我们目前有两个思路：

- SBT接口直接由数据库调用，将本地备份中的文件创建，打开，写入等操作，用SBT接口替换


![](https://pingcode.yasdb.com/atlas/files/public/6739693fa1ad9a3311dc7541/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

- 数据库和yasramn工具之间使用tcp传输数据，yasramn工具去调用SBT接口把数据传输到第三方备份软件


![](https://pingcode.yasdb.com/atlas/files/public/6739693fa1ad9a3311dc7542/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

方案一：

优势：整体性能好，逻辑简单，不需要启动额外的进程

缺点：yashanDB是多线程架构，无法与第三方动态库解耦

方案二：

优势：第三方库与yashanDB服务器解耦，安全性高，易于升级

缺点：二次转发，性能较差，占用资源稍高

  


### XBSA接口

[XBSA-api.pdf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5M2VhMWFkOWEzMzExZGM3NTM0IiwicmVmX2lkIjoiNjczOTY5M2U1OTNmOTljOWZmMjM0YzI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MTc3LCJleHAiOjE3ODIyMTI1Nzd9.UhuU1KTxMjFEsCKxlM109ZFFa9Mrd-AL4cmmiatjWSA)

```
int BSABeginTxn (long);
int BSACreateObject(long, BSA_ObjectDescriptor *, BSA_DataBlock32 *);
int BSADeleteObject(long, BSA_UInt64);
int BSAEndData(long);
int BSAEndTxn(long, BSA_Vote);
int BSAGetData(long, BSA_DataBlock32 *);
int BSAGetEnvironment(long, BSA_ObjectOwner *, char **);
int BSAGetLastError(BSA_UInt32 *, int *);
int BSAGetNextQueryObject(long, BSA_ObjectDescriptor *);
int BSAGetObject(long, BSA_ObjectDescriptor *, BSA_DataBlock32 *);
int BSAInit(long *, BSA_SecurityToken *, BSA_ObjectOwner *, char **);
int BSAQueryApiVersion(BSA_ApiVersion *);
int BSAQueryObject(long, BSA_QueryDescriptor *, BSA_ObjectDescriptor *);
int BSAQueryServiceProvider(BSA_UInt32 *, char *, char *);
int BSASendData(long, BSA_DataBlock32 *);
int BSATerminate(long);
```

  


备份流程图

![](https://pingcode.yasdb.com/atlas/files/public/673969408970c2af4f51f6cc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

恢复流程图

![](https://pingcode.yasdb.com/atlas/files/public/673969408970c2af4f51f6cd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

## 4. 总体方案

1. 选用XBSA接口，该接口是通用的规范，与鼎甲适配更方便
1. yasrman工具加载第三方libxbsa.so动态库，并部署在备份服务器
1. 数据库进程和yasrman采用tcp通信传输数据，yasrman通过XBSA接口转发给备份服务器
1. OM开发独立的客户端工具yasbak(名字待定)，鼎甲的备份server调用yasbak工具，下发备份恢复命令，无需配置ssh免密


### 部署方式

![](https://pingcode.yasdb.com/atlas/files/public/67396940a1ad9a3311dc7543/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

### 具体流程

#### yasrman加载api

- OM安装部署的时候，将鼎甲提供的libxbsa.so安装到yasdb的lib目录
- yasrman的备份恢复命令添加入参  **parms "XBSA_LIBRARY=/home/yasdb/**    [libxbsa.so](http://libxbsa.so)    **, TOKEN=122333,**  **ENV=(key1=val1,key2=val3,....)"**   其中ENV内的参数列表由鼎甲提供，比如备份服务器IP，压缩，加密属性等
- 鼎甲调用yasbak的时候，就可以指定上面的ENV参数，yasbak传给yasrman，启动流式备份恢复


#### yasrman调用api

yasrman和数据库之间的远程备份，目前采用tcp连接，只要将远程备份的磁盘读写替换为XBSA接口，即可实现流式备份。

1. **初始化**
1. int BSAInit(long *bsaHandlePtr, BSA_SecurityToken *tokenPtr, BSA_ObjectOwner *objectOwnerPtr, char **environmentPtr)
1. 该接口会申请一个session，后续的数据传输都在该session内进行。其中environmentPtr对应ENV入参，objectOwnerPtr对应备份集名，bsaHandlePtr是返回的session句柄
    1. 因为yasrman要支持多通道，所以  **对每个通道，都会执行一次BSAInit**  ，每个通道在各自的session内传输数据
    1. objectOwnerPtr内有两个字符串变量，  **bsa_ObjectOwner**  ：鼎甲定义的备份集名；  **app_ObjectOwner**  ：yasrman定义的备份集名。  **这个变量的格式需要和鼎甲对齐**
1. **备份文件**
1. 将yasrman的createFile，writeFile，closeFile分别替换为BSACreateObject，BSASendData，BSAEndData。其次，在外面包一层BSABeginTxn 和BSAEndTxn
1. **恢复文件**
1. 将yasrman的openFile替换为BSAQueryObject+BSAGetObject，readFile和closeFile替换为BSAGetData和BSAEndData。其次，在外面包一层BSABeginTxn 和BSAEndTxn
1. **结束**
1. 结束时，依次调用BSATerminate将所有的session关闭，然后yasrman进程退出


#### 鼎甲调用yasbak

该工具只能进行备份恢复相关的操作，由go语言开发，是个独立的可执行文件

鼎甲的备份软件安装的时候，将yasbak，yasrman一起安装，并配置相应的参数

除了备份集的创建外，备份集的删除，也需要调用yasbak，用来将备份集记录从系统表删除

### 分布式备份支持

目前的分布式备份，有yasrman连接所有DN节点，进行本地备份，远程备份还不支持，需要支持远程备份

1. yasrman工具连接所有DN，启动多个备份线程
1. 每个备份线程只备份一个DN，通过XBSA接口转发数据


鼎甲适配点：

1. 多个实例的备份集，怎么在备份服务器区分？备份集命名对齐
1. 查询和删除分布式的备份集，是按一个整体，还是按照一个实例
1. 多个备份服务器，负载均衡


## 5. 工作量评估

单机流式备份的工作量评估：

存储：2周

工具：2周

鼎甲：

分布式流式备份的工作量评估：

存储：

工具：

鼎甲：

  


## 6. TODO

### 接口对齐

- BSAInit
-     1. tokenPtr：该入参是否由鼎甲提供？
    1. objectOwnerPtr：bsa_ObjectOwner和app_ObjectOwner的格式需要对齐，要考虑单机和分布式，以及集群。还有多通道下，每个BSAInit的入参是否需要一致？
    1. environmentPtr：这个变量值，是否全部由鼎甲提供？

- BSACreateObject
-     1. BSA_ObjectDescriptor：这里面有很多成员，有哪些我们是必要的，需要对齐
    1. ![](https://pingcode.yasdb.com/atlas/files/public/67396940a1ad9a3311dc7544/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

- BSAQueryObject
-     1. BSA_QueryDescriptor：这里面有很多成员，有哪些我们是必要的，需要对齐
    1. ![](https://pingcode.yasdb.com/atlas/files/public/67396940a1ad9a3311dc7546/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBZ0JBZ1FBUUFBQUFDQUJBQUFBQWdBZ0FBSUFBQkFBQUFBZ0FBQUFJQXdBQUFFQUFBQUJDUXdFQUFBUUFBQUFBQUFnQUFBQUVBRUFoQUFBQkFBREFBQUFBQUFnQUFnSUFBQUFBQkFFQUlBQUFBQUFBQUFDQUFBQ0FnQUFDQUFBd0FJaUFDQUFBd0FCQVFBQWdBQUFBQVFBQUFBQVFBQUNBa0FJQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzcsImV4cCI6MTc4MjEzNjk3N30.xwkiS1kMHqqta-OlSvdej6LVagfHXPLDIcf77zhR8IM)

- BSASendData，BSAGetData
-     1. bufsize是否需要对齐，鼎甲对buffer大小有何限制？



### 安装部署

-   [libxbsa.so](http://libxbsa.so)    的集成：
- yasbak的集成：


### 升级方案

XBSA动态库升级：yasrman不是常驻进程，禁止备份恢复后，替换libxbsa.so即可

yasbak工具升级：1. 独里升级，脱离数据库升级；2. 随数据库一起升级

鼎甲软件升级：todo

  


## 基于xbsa模拟器的yasrman流式备份调试

### 初始化

第一次使用前，需要创建catalog目录，用来存放yasrman的配置文件和存储备份集的元信息：

yasrman sys/Cod-2022@127.0.0.1:1601  ** -c 'create catalog' -D catalog路径**

catalog路径在后面的语法中都要使用

**流式备份和恢复**

流式备份属于远程备份dest client，此外还多了一个params语法，来  **指定xbsa.so的路径**  ，token，和xbsa所需的参数。另外流式备份不要设置format指定备份路径，仅需要设置tag

目前token和参数在模拟器内不起作用，可以随便设置。

1. 全量备份：yasrman sys/Cod-2022@127.0.0.1:1601 -c "backup database tag 'bak_full_10' parallelism 4   **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so)    **, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  " -D catalog路径
1. 增量备份：
    1. yasrman sys/Cod-2022@127.0.0.1:1601 -c "backup database incremental level 0 tag 'bak_incr_0'    **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so)    **, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  " -D catalog路径
    1. yasrman sys/Cod-2022@127.0.0.1:1601 -c "backup database incremental level 1 tag 'bak_incr_1'   **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so)    **, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  " -D catalog路径
1. 恢复：
    1. 先清理数据库残留文件，启动到nomount
    1. yasrman sys/Cod-2022@127.0.0.1:1601 -c "restore database from tag 'bak_incr_1'   **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so)    **, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  " -D catalog路径


和普通备份一样，并行度，压缩，加密，切片大小都可以设置，具体参考    [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasrman/00yasrman.html](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasrman/00yasrman.html)  

  


token，xbsa库的路径和参数由鼎甲输入，执行备份和恢复的command字符串也由鼎甲输入。

xbsa模拟器调用的是文件系统的接口，直接在catalog所在的目录里创建文件

  


## yasbak功能用法介绍

yasbak是一个针对yasrman的管理工具，对yasrman进行了简单封装，方便客户快速上手。

### 命令行参数

|命令参数|备注|
|---|---|
|yasbak deploy|初始化yasbak和yasrman所需的运行环境|
|yasbak run|获取数据库信息，并调用yasrman执行备份、备份清理或恢复操作|
|yasbak clean|清理yasbak和yasrman初始化时生成的目录和配置|


#### yasbak deploy

参数说明：

|参数名|默认值|必须|说明|
|---|---|---|---|
|-c,--cluster|无|是|指定一个名称，该名称将用于配置等数据命名，一个数据库对应一个名称，建议与OM部署时的名称保持一致|
|-a,--addr|无|是|指定数据库的yasom访问地址，格式为<ip>:<port>，yasbak将通过该地址与OM进行通信|
|-k,--key|无|是|连接OM时校验的token，需要和OM配置保持一致|
|-D,--cata-log|无|是|yasrman所使用的cata log，将指定路径生成该目录。,若未初始化，将使用yasrman进行初始化，若已初始化将忽略。|
|-u,--user|无|是|连接数据库使用的用户名，后续执行备份时默认将使用该用户|
|-p,--password|无|是|连接数据库用户对应密码，该密码将通过  **多次加密后保存在本地配置文件**  内，执行clean可以清理配置。|
|-t,--cert|无|否|当OM指定TLS加密通信时，需要指定对应的加密证书|
|-S,--server|无|否|当OM指定server名称后，需要指定该名称|


用法示例：

```
./bin/yasbak deploy -c se -a 127.0.0.1:1675 -k 96ed7a2c90e81a9e -D ./catalog -u sys -p Cod-2022
```

#### yasbak run

|参数名|默认值|必须|说明|
|---|---|---|---|
|-c,--cluster|无|是|deploy时指定的cluster名称|
|-s,--sql|无|是|指定yasrman运行的SQL|
|-u,--user|deploy时指定的user|否|执行yasrman使用的用户，若不指定将使用deploy时的用户名。|
|-p,--password|deploy时指定的password|否|执行yasrman使用的密码，若不指定将使用deploy时的密码，yasbak解密后内部使用。|
|-r,--role|standby|否|可选参数：primary|standby，使用指定类型节点进行备份操作。|


用户示例：

```
# 执行备份
./bin/yasbak run -c se -s "backup database tag 'bak_full_11' parallelism 4 dest client params 'XBSA_LIBRARY=/lib/libxbsa.so, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'"

# 清理备份
./bin/yasbak run -c se  --sql "delete backupset tag 'bak_full_11'"
```

#### yasbak clean

|参数名|默认值|必须|说明|
|---|---|---|---|
|-c,--cluster|无|是|deploy时指定的cluster名称|
|-f,--force|false|否|是否进行信息确认，输入yes/no|
|-p,--purge|false|否|清理时是否同时删除 cata log目录|


用法示例：

```
./bin/yasbak clean -c se --purge
```

## Attachments:

[image2023-6-5_21-36-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5M2U4OTcwYzJhZjRmNTFmNmJkIiwicmVmX2lkIjoiNjczOTY5M2U1OTNmOTljOWZmMjM0YzI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MTc3LCJleHAiOjE3ODIyMTI1Nzd9.V5vtSxWjLwoz0lU58ZIvKe1xrh3AIL0FBaW2IVS4fNs)

 (image/png)    


[image2023-6-6_9-23-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5M2ZhMWFkOWEzMzExZGM3NTM4IiwicmVmX2lkIjoiNjczOTY5M2U1OTNmOTljOWZmMjM0YzI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MTc3LCJleHAiOjE3ODIyMTI1Nzd9.qhjLmNj2KIwxBNVusT2C61LffILmccZ2Sk7yOclWYS0)

 (image/png)    


[image2023-6-6_9-26-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5M2ZhMWFkOWEzMzExZGM3NTNhIiwicmVmX2lkIjoiNjczOTY5M2U1OTNmOTljOWZmMjM0YzI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MTc3LCJleHAiOjE3ODIyMTI1Nzd9.uffVBwxK1is0kF3Fl5Sg5V5hS7doUFXdeva4v5o-Wgk)

 (image/png)    


[XBSA-api.pdf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5M2VhMWFkOWEzMzExZGM3NTM0IiwicmVmX2lkIjoiNjczOTY5M2U1OTNmOTljOWZmMjM0YzI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MTc3LCJleHAiOjE3ODIyMTI1Nzd9.UhuU1KTxMjFEsCKxlM109ZFFa9Mrd-AL4cmmiatjWSA)

 (application/pdf)    


[image2023-6-6_17-44-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5M2Y4OTcwYzJhZjRmNTFmNmM1IiwicmVmX2lkIjoiNjczOTY5M2U1OTNmOTljOWZmMjM0YzI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MTc3LCJleHAiOjE3ODIyMTI1Nzd9.sAWLWlqgeIE1o7ebxAHpdBn7AEb0_kcsn5aLYb9SiqM)

 (image/png)    


[image2023-6-8_14-38-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5M2Y4OTcwYzJhZjRmNTFmNmM3IiwicmVmX2lkIjoiNjczOTY5M2U1OTNmOTljOWZmMjM0YzI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MTc3LCJleHAiOjE3ODIyMTI1Nzd9.eozOqQOHDd2elMmNgcJ0QKeojXQX8QTXGrkaIl5xhyQ)

 (image/png)    


## Comments:

|  [](null)  ,1. 尽量使用XBSA接口
1. 鼎甲需要实现XBSA接口动态库，实现管控界面
1. 鼎甲接口初始化参数如何指定
,  
,笔记,1. 鼎甲已经实现其他数据库xsba的适配，    
  2. 鼎甲不用数据块本身自带的压缩， 在API内压缩。 实现的sbtwrite接口里面自己实现了切片压缩 加密。    
  3. 压缩算法可选。lz4 zstd    
  4. 建议远程备份方案直接植入备份接口，数据库不直接调用第三方so    
  5. sbt支持并行，多通道    
  6. 高斯 tbase 使用的xbsa接口规范    
  7 使用ssh远程免密节点执行备份命令，安全性待讨论    
  8. 鼎甲重复删除算法 指纹计算，可以去重，减少tcp流量，所以第三方so放在数据库所在服务器更合适    
  9. 分布式备份对接由数据库这边实现,Posted by mazhihong at 六月 06, 2023 10:53|
|---|
|  [](null)  ,1. 鼎甲的server端，直接调用yasboot（可能要封装一个仅支持备份的工具），无需走ssh免密流程
1. yasramn去调用XBSA接口，即使XBSA有问题，也不影响数据库
1. om在需要执行备份的node所在host上，把yasramn启动，数据库发送数据给yasramn，yasrman再转发给鼎甲server
1. 安装部署的时候，需要将鼎甲实现的libxbsa.so部署到数据库里
,Posted by mazhihong at 六月 06, 2023 16:58|
|  [](null)  ,1. 华润单机主备部署
1. 先实现单机的流式备份
1. 非侵入式部署
,需求范围,yashan：,1. yasramn适配xbsa接口
1. 提供yasbak命令工具
1. 提供在备份服务器安装部署和升级的流程
,鼎甲：,1. 适配yashan备份命令，全量，增量，PITR
1. 识别数据库，列表数据库，主备识别
1. 适配XBSA库（参数设置，多通道支持，备份名格式）
,Posted by mazhihong at 六月 13, 2023 10:56|
|  [](null)  ,1. yasbak选择主机或者备机去备份，最优备
1. yasbak创建备份用户，从om获取备份用户和密码
1. yasbak打包和部署，参数，token
1. yasbak命名
1. 和鼎甲对接他们怎么调用yasbak，鼎甲升级换包
1. yasbak初始化yasramn
1. 确认华润有没有使用yasom
,Posted by mazhihong at 六月 27, 2023 18:01|
