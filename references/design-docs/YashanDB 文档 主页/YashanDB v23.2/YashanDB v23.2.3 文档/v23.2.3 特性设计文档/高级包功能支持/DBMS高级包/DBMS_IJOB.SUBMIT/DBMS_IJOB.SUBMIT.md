Created by 陈秋富 on 十一月 16, 2022

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91762193#id-%E5%BC%80%E5%8F%91%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3%E6%A8%A1%E7%89%88-1-overview%E6%A6%82%E8%BF%B0)  

**函数功能：用户A（sys或者dba权限）可以通过函数给用户B创建任务JOB。**

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91762193#id-%E5%BC%80%E5%8F%91%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3%E6%A8%A1%E7%89%88-2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

**用户A可以给用户B创建任务JOB。但是用户A必须是sys或者DBA用户，或者具有all privileges权限的用户。**

**函数名称：SYS.DBMS_IJOB.SUBMIT ( ARGLIST )  或 DBMS_IJOB.SUBMIT ( ARGLIST )**

**参数列表：**

|**参数名**|**类型**|**输入输出**|**是否必填**|**默认值**|**说明**|
|---|---|---|---|---|---|
|JOB|BINARY_INTEGER|OUT|是|  
|必填，返回当前创建的JOBID编号|
|LUSER|VARCHAR2|IN|无|  
|选填，不生效|
|PUSER|VARCHAR2|IN|无|  
|选填，不生效|
|CUSER|VARCHAR2|IN|  
|默认为当前用户|执行定时任务的用户|
|NEXT_DATE|DATE|IN|  
|默认为当前时间|任务下次执行的时间。|
|INTERVAL|VARCHAR2|IN|  
|默认为NULL|表达式文本，用于计算定时任务下次执行的时间，表达式为NULL表示定时任务只执行一次。通过表达式计算出的时间必须为将来时间或者NULL。|
|BROKEN|BOOLEN|IN|  
|默认为FALSE|标志参数，TRUE标示任务中断，以后不会运行|
|WHAT|VARCHAR2|IN|是|  
|定时任务要执行的PL/SQL文本，可以是匿名块或者存储过程，必须以分号结束。|
|CS_LAB|RAW MLSLABEL|IN|无|  
|选填，不生效|
|CS_HI|RAW MLSLABEL|IN|无|  
|选填，不生效|
|CS_LO|RAW MLSLABEL|IN|无|  
|选填，不生效|
|NLSENV|VARCHAR2|IN|无|  
|选填，不生效|
|ENV|RAW|IN|无|  
|选填，不生效|


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91762193#id-%E5%BC%80%E5%8F%91%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3%E6%A8%A1%E7%89%88-3-interfaces%E6%8E%A5%E5%8F%A3)  

**bipVerifyIJobSubmit**

**bipExecIJobSubmit**

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=91762193#id-%E5%BC%80%E5%8F%91%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3%E6%A8%A1%E7%89%88-4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

**1、可输入参数为2~13个，JOB为输出参数，其余只有CUSER、NEXT_DATE、INTERVAL、BROKEN、WHAT有具体的功能。**

**2、JOB和WHAT参数必填。其中只有JOB、CUSER、NEXT_DATE、INTERVAL、BROKEN、WHAT这几个参数能生效。**

**3、执行该函数的用户必须是 sys 、DBA角色用户或者具有all privileges权限的用户。**

**4、WHAT参数输入的为PL/SQL文本，**  **可以是匿名块或者存储过程，必须以分号结束。**  **否则可能出现job执行失败的情况。**

**5、如果**  **INTERVAL为NULL，**  **在创建后，JOB会执行一次，然后符合auto drop的情况时，会自动从JOB表中被删除掉。**

**6、成功创建的定时任务将可以在DBA_JOBS/ALL_JOBS/USER_JOBS视图中查询**

**7、用户输入参数时，就读用户输入的，没有就取预设定的默认值，参数名输错时也使用默认值；**

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91762193#id-%E5%BC%80%E5%8F%91%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3%E6%A8%A1%E7%89%88-5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

**（1）输入字符串的解析，原本的bip函数的输入字符串解析为  pack.func，而该特性需要验证的字符串为 SYS.DBMS_IJOB.SUBMIT 三个部分组成，所以这块会涉及到 **  **verifyBuiltinPackMethod**  ** 里面的字符串解析，nameexpr的count需要变更校验为3。**

**（2）新增 DBMS_IJOB 的内置函数包，添加函数 bipVerifyIJobSubmit 和 bipExecIJobSubmit 。**

**（3）调用 bipAdjustArgs 函数，调整可选参数位置，以及将注册的参数补充到arglist中。**

**（3）**  **bipVerifyIJobSubmit阶段，校验当前用户的权限是否是sys或者dba用户；**

**（4）bipExecIJobSubmit阶段，校验当前用户的权限是否是sys或者dba用户；循环取arglist中参数；构造JobDef结构体内容；然后将JobDef内容按照原本的接口插入到 SYS.SCHEDULER$_JOB 和 SYS.OBJ$ 表中。**

**（5）涉及到系统表 sys.scheduler$_job 和 sys.obj$ 表。**

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91762193#id-%E5%BC%80%E5%8F%91%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3%E6%A8%A1%E7%89%88-51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91762193#id-%E5%BC%80%E5%8F%91%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3%E6%A8%A1%E7%89%88-52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

**bipAdjustArgs **

![](https://pingcode.yasdb.com/atlas/files/public/67396d8ca1ad9a3311dc91ff/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFFQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWlBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkyMzUsImV4cCI6MTc4MjMyMDAzNX0.u0AYLu84XJPJkAtCRX6ATJAgCxgH7zMTFCuOiRCvll8)

**bipVerifyIJobSubmit阶段：**

**bipExecIJobSubmit阶段：**

![](https://pingcode.yasdb.com/atlas/files/public/67396d8ca1ad9a3311dc9200/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFFQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWlBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkyMzUsImV4cCI6MTc4MjMyMDAzNX0.u0AYLu84XJPJkAtCRX6ATJAgCxgH7zMTFCuOiRCvll8)

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91762193#id-%E5%BC%80%E5%8F%91%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3%E6%A8%A1%E7%89%88-53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

*说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计*

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91762193#id-%E5%BC%80%E5%8F%91%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3%E6%A8%A1%E7%89%88-6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

**1、注意输入的参数，能支持2~13个参数，但是只有上述列的5个参数能有效处理。其余空实现。**

**2、WHAT对应的参数是必填的，为空，或者缺少时都会报错。**

**4、INTERVAL字段不填或者NULL时，默认执行一次，此时JOB的视图中看不到该job，因为执行完自动删除了。**

**5、CUSER字段不填时，默认插入当前函数调用者。**

**6、要注意CUSER有无执行WHAT任务的权限或者能力，否则会执行失败。**

**7、WHAT参数输入的是PL/SQL文本，**  **可以是匿名块或者存储过程，要注意必须以分号结束。**

**8、注意函数调用用户为sys或者具有dba权限的用户。**

##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=91762193#id-%E5%BC%80%E5%8F%91%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3%E6%A8%A1%E7%89%88-7-document%E8%B5%84%E6%96%99)  

  [DBMS_IJOB.SUMBIT调研 - 陈秋富 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=91767193)  

  [DBMS_IJOB.SUBMIT Design - 陈秋富 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~chenqiufu/DBMS_IJOB.SUBMIT+Design)  

##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=91762193#id-%E5%BC%80%E5%8F%91%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3%E6%A8%A1%E7%89%88-8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91762193#id-%E5%BC%80%E5%8F%91%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3%E6%A8%A1%E7%89%88-9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2022-9-30_11-39-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOGM4OTcwYzJhZjRmNTIxMzhhIiwicmVmX2lkIjoiNjczOTZkOGM3MjgyMDZlZmI5MmYyMDVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MjM0LCJleHAiOjE3ODIzOTU2MzR9.1i1r5du8IQ1uAHIVlFI-er5Xf1_ksrFQyCLCH3mL83s)

 (image/png)    


[image2022-9-30_10-20-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOGNhMWFkOWEzMzExZGM5MWZkIiwicmVmX2lkIjoiNjczOTZkOGM3MjgyMDZlZmI5MmYyMDVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MjM0LCJleHAiOjE3ODIzOTU2MzR9.KbVyd7oV9HO8lqMKQFleQZi1rwsx7Z8XOLRmHygPQuM)

 (image/png)    


[image2022-9-30_10-19-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOGNhMWFkOWEzMzExZGM5MWZlIiwicmVmX2lkIjoiNjczOTZkOGM3MjgyMDZlZmI5MmYyMDVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MjM0LCJleHAiOjE3ODIzOTU2MzR9.hUxFs53bY6iikcgNFxFg-6ptKUygD5nM81VT_7Ycf9k)

 (image/png)    
