Created by 徐瑶, last modified on 十月 31, 2023

# 1. 概述 

支持library的导入导出

# 2. 需求分析 

SR:    [YDBRD-13262](https://jira.yasdb.com/browse/YDBRD-13262?src=confmacro)    -  【imp/exp】支持library导入导出  完成

支持library导入导出

# 3. 测试设计方法 

主要采用的等价类划分，场景法组合及错误推测法进行设计 

# 4. 详细测试设计

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|library_name|1.库名内容,（1）英文（大小写）,（2）中文,（3）特殊字符,（4）混合等,2.库名长度：1到64,3.是否带有单/双引号|  
|  
|  
|
|库文件路径|1.目录,（1）当前路径：./、 .    确认当前路径,（2）上层路径：../,（3）home路径：~,（4）绝对路径：/tmp/dir,2.1<=长度<=255字节(根据终端类型确定范围),3.文件名内容：,（1）中文,（2）英文,（3）特殊字符（含有空格、其它符合终端的目录要求的特殊字符）,4.空格|  
|1.不带单引号,2.路径带双引号,3.完整路径  长度超过255字节,4.空串,修改导出文件内容,  
|  
|
|导入导出时library个数|1个,2个,1w个,  
|  
|  
|  
|
|导入导出模式|1.full=y模式导出,(1).full=y导入,(2).full=n导入,(3).  schema  导入|  
|导入导出模式为tables模式  （如有依赖库的情况）|  
|
|  
|2.full=n模式导出,(1).full=y导入,(2).full=n导入,(3).  schema  导入|  
|  
|  
|
|  
|3.  schema  模式导出,(1).full=y导入,(2).full=n导入,(3).  schema  导入|  
|  
|  
|
|导出命令参数OWNER|同登录用户|  
|  
|  
|
|  
|非登录用户,1.一个,2.多个|  
|  
|  
|
|导入命令参数FROMUSER |同登录用户|  
|  
|  
|
|  
|非登录用户,1.一个,2.多个|  
|  
|  
|
|导入时library是否存在|1.全不存在,2.全存在   ,3.部分存在，部分不存在|结合ignore=n/y,  
|  
|  
|
|用户|1.创建library不指定所有者，用另一个用户导入,2.  导出后将library所属用户删除后进行导入,3.多个用户有多个library进行导入导出|  
|  
|  
|
|权限|full导入导出有dba权限|  
|无dba权限|  
|
|  
|导入导出登录用户的library有dba权限,导入导出登录用户的library只有create session 和create library的权限|  
|无create session 和create library的权限|  
|
|  
|导入导出非登录用户的library有dba权限|  
|无dba权限|  
|
|与其他对象有依赖关系|ignore=n/y，导入之前对库进行增删改操作,function调用library,多个function同时调用library|  
|  
|  
|
|使用库|与其他特性结合|procedure中调用library还未实现,create procedure test_pro AS LANGUAGE java name 'example.UDFexample.execJdbcexample(int) return string'library test_library;,feature "external java with procedure" is not implemented yet|  
|  
|
|库的语法图（有无增删改）|  
|无语法图|  
|  
|
|与触发器结合，触发器中使用到这个库，导入前删掉库|结合ignore=n/y|需要结合procedure，procedure中调用java子程序还未实现,feature "external java with procedure" is not implemented yet|  
|  
|


# 5. 测试用例 

# 6. 测试框架设计

本次测试采用导入导出测试框架实现，执行py文件，对导入后视图进行检验。

# 7. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|
