Created by 钟溱, last modified on 十月 12, 2024

23.2：       [YDBRD-21757](https://jira.yasdb.com/browse/YDBRD-21757)       -     【yasql】支持静默登陆     完成

23.1：       [YDBRD-21450](https://jira.yasdb.com/browse/YDBRD-21450)       -     【yasql】yasql支持-S，屏蔽不重要的信息，打印列名和结果     完成

22.2：       [YDBRD-13875](https://jira.yasdb.com/browse/YDBRD-13875)       -     【yasql】yasql支持-S，屏蔽不重要的信息，打印列名和结果     完成

# 1. 概述

静默模式使用yasql。静默模式和非静默有以下区别：

（1）命令行提示(SQL>)

（2）命令回显信息（相当于echo off）

（3）登陆时显示的提示信息。登陆时省略了用户的用户名和密码，或者用户名密码输入错误，静默模式下，无提示信息。please input user name:，please input password: 

（4）版本信息

静默非静默，除以上信息外，无差异，如：结果集显示，错误信息等。

# 2.  需求分析

## 2.1 功能点分析

- （1）静默模式开启方式：yasql -S username/pwd。-S[ILENT] 必须第一个arg，不区分大小写。


## 2.2 应用场景

- yasql -S user/password@ip:port 登录，不会有提示信息；
- yasql -S 登录，不会提示输入user；不会提示输入passowrd；
- 执行SQL，不会有 SQL> 输入提示符
- exit后不会有提示信息


## 2.3. 规格约束

- 静默登录回显信息：（检查回显信息时，最好跟Oracle要比对下）
- ![](https://pingcode.yasdb.com/atlas/files/public/67396ba88970c2af4f52061d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYxMzQsImV4cCI6MTc4MjMwNjkzNH0.XB-Am-evenp-VacTHPGLrUZzm4BbC8yLhh1mrDSkOJs)


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

## 3.2   详细测试设计

基本功能：

|测试点|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|静默模式 -s语法|yasql -s/S   |1、不区分大小写,2、登录后，查询登录用户显示正确,select     sys_context  (  'userenv'  ,  'session_user'  )     from     dual  ;|yasql  -Ss,yasql S/s,yasql --s/ --S,yasql -slice |多余s|
||yasql -S/s  username/password@ip:port|有无用户名密码以及ip和端口号都可正常登录且无提示信息|yasql  -|缺少s|
||yasql -S/s as sysdba|1、免密登录,2、登录后，查询登录用户显示正确|yasql -sa|错误语法|
||反复登录退出登录退出|正常|yasql  -S 错误的用户名/密码|  
|
||创建用户名称为s的用户，使用静默登录|(-v查看版本信息、-h查看帮助信息)|yasql username/password@ip:port -s|yasql只能在第一参数，oracle位置校验(oracle也无法登录)|
||静默登录成功后。执行!yasql -s xxx/xxx@ip:port 切换登录|  
|  
|  
|
|登录提示信息|yasql -s 错误的用户名/密码|1、无提示信息，不显示please input user name:等,2、正确数据用户密码后，能登录进去，还是静默登录模式；|  
|  
|
||yasql -s 正确的用户名/密码|成功登录，但无版本信息|  
|  
|
||  
|  
|yasql -s username/password 带错误端口号|  
|
||  
|  
|yasql -s username/password 不带端口号|  
|
|执行sql|select 1 from dual；    
  select,1,from ,dual;|执行命令无命令行信息SQL>|yasql -s -s -f -e 执行用例文件|  
|
||select * from （不存在的表）|除error信息外无其他提示信息|yasql  -f -s -e 执行用例文件|  
|
||；查看上一条sql|无行号（oracle是有）非静默也无行号|yasql -f -e -s 执行用例文件|  
|
||@路径/用例名.sql ,在文件中conn切换用户|正常执行用例文件，用例结果无误，无SQL>|yasql -s -f -e 执行不存在的用例文件|  
|
||yasql -s -f -e 执行用例文件,在文件中conn切换用户|正常执行用例文件，用例结果无误，无SQL>,-e和-s的功能有冲突 结果应该时显示,oracle支持-f和-e？（报错）|  
|  
|
||执行的sql覆盖：,1、DML、DQL、DDL都挑一部分执行；,2、构造步骤1中的语句有报错的情况，能正常报错,3、执行的sql文件里面包含静默登录的操作（！yasql），用yasql -f -e执行和yasql -s -f -e执行|在用例文件内,！yasql -s sys/Cod-2022@127.0.0.1:1688,静默登录后无法继续进行DML、DDL等操作,可以用,!yasql -s test2/123456@127.0.0.1:1688 -c "select 1 from dual;"这样进行操作|  
|  
|
|切换用户|yasql -s 登录后 conn其他用户|  
|  
|  
|
|  
|exit；,exit后切换非静默登录（同样的用户密码IP端口号）|exit后切换非静默登录依旧显示提示信息|  
|  
|
|DDL|yasql -S连接后create、drop、truncate等操作|  
|  
|  
|
|DML|yasql -S连接后insert、update、delete等操作|测试查询结果是否正确、测试修改后的结果是否正确|  
|  
|
|多个会话同时连接|1、全部会话都是静默登录，所有session符合静默登录的回显,2、部分session是静默登录，部分不是，session之间互不影响|  
|  
|  
|
|分布式差异点|使用yasql -s链接dn，mn节点|（未测）|  
|  
|
|可靠性操作|1、静默登录后，shutdown数据库，重启数据库静默登录,2、静默登录后，kill掉数据库，重启数据库静默登录,3、静默登录后，ctrl+c终止数据库，重启数据库静默登录|再做可靠性操作时，需要关注数据库打印的信息    
    
|  
|  
|


  


## 3.3 DFX测试设计

|系统级DFX分类|是否涉及|
|---|---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成部分自动化用例；


详见附件

# 5. 测试框架设计

- 部分测试点不能自动化，在文本用例，进行手动测试
- 使用guider框架，执行sql文件 对比预期与实际输出结果


# 6. 测试环境说明

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：3  *人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Attachments:

[yasql-s-21757.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYThhMWFkOWEzMzExZGM4NDkzIiwicmVmX2lkIjoiNjczOTZiYTc3MjgyMDZlZmI5MmYwODllIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTM0LCJleHAiOjE3ODIzODI1MzR9.oa38UXTAc0vBOTl291oPsBxT2lAsk9WlEYvfh4p_Gi0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
