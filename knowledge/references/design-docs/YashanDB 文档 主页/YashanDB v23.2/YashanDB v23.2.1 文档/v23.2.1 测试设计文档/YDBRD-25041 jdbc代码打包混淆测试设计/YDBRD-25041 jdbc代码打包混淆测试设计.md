Created by 李潮, last modified on 一月 09, 2024

# **1. 概述**

IR：    [YDBRD-23034](https://jira.yasdb.com/browse/YDBRD-23034?src=confmacro)    -  jdbc发布maven  完成

SR:    [YDBRD-25041](https://jira.yasdb.com/browse/YDBRD-25041?src=confmacro)    -  【jdbc】jdbc代码打包混淆  完成

参考：开发设计文档：    [jdbc发布maven设计文档 - 方少奎 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141573660)  

调研文档：    [YDBRD-23034 jdbc发布maven 测试调研 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141569612)  

jdbc包通过混淆插件在不影响外部调用的情况下，对私有变量等进行代码混淆，并将混淆后的包发布maven仓库。

# **2. 需求分析**

## 2.1 功能介绍

对jdbc.jar包进行代码混淆后，代码易读性，可读性和可理解性下降，但不影响正常功能的使用。

## 2.2 规格约束

无

# **3 详细测试设计**

**本SR不涉及新增功能，不涉及原有功能变化，仅在源码阅读上提升门槛，故不新增用例进行测试。**

通过上车流程，执行二层CI 单机 JDBC用例验证功能是否正常，需要关注以下内容：

|测试点|是否通过|
|---|---|
|用例编译：用例仓库原本调用方法是否保持一致（方法名，入参，出参，抛出异常）|  
|
|用例执行：用例执行是否全部通过|  
|
|用例结束：用例执行结束后是否出现未释放的变量（通过是否影响后续用例执行确认）|  
|


其他可关注：源码中涉及private作用域的类，方法，变量的名称是否进行混淆

专项测试设计情况：

|专项|是否涉及|
|:---|:---|
|并发|是|
|可靠性|否|


# **4 文本用例**

无新增用例，无文本用例

# **5 测试用例**

  
    
    


# **5 测试框架设计**

Gradle