Created by 刘亮杰, last modified on 八月 15, 2024

## 一、介绍

![](https://pingcode.yasdb.com/atlas/files/public/67396d3c8970c2af4f521154/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBaUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY4NDgsImV4cCI6MTc4MjMxNzY0OH0.BF0-X5O2giBrc3zwLc6mQjaY6hSk_si67kUXlosIUpw)

YashanDB Python驱动（python-yasdb）是支持    [Python DB API协议 (opens new window)](https://peps.python.org/pep-0249/)    的Python拓展模块，该模块可使通用Python应用程序直接连接YashanDB数据库。

YashanDB的产品安装包中提供两个python驱动包：yasdb、yaspy。开发人员安装其一后即可连接YashanDB数据库进行访问操作（YashanDB23.2之后不再对yaspy模块进行功能扩展，建议用户安装使用yasdb模块）。本章所列内容仅以yasdb为例，yaspy模块可进行参考。

模块包含如下内容：

- connect()：创建数据库连接的构造函数。
- Globals：模块中定义的变量。
- Connection：Python应用程序到数据库的连接对象。
- Cursor：连接数据库后创建的游标对象。


### 1、安装

使用YashanDB Python驱动需要先安装和配置YashanDB客户端获取YashanDB C驱动库，并将  c驱动动态库添加到环境变量，  操作过程请参考安装手册    [YashanDB客户端安装](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%AE%89%E8%A3%85%E5%92%8C%E5%8D%87%E7%BA%A7/%E5%AE%89%E8%A3%85%E9%83%A8%E7%BD%B2/YashanDB%E5%AE%A2%E6%88%B7%E7%AB%AF%E5%AE%89%E8%A3%85/00YashanDB%E5%AE%A2%E6%88%B7%E7%AB%AF%E5%AE%89%E8%A3%85)    章节。

1.依据安装手册    [YashanDB软件包清单](https://conf.yasdb.com/%E5%AE%89%E8%A3%85%E5%92%8C%E5%8D%87%E7%BA%A7/%E5%AE%89%E8%A3%85%E9%83%A8%E7%BD%B2/%E5%AE%89%E8%A3%85%E5%89%8D%E5%87%86%E5%A4%87/%E4%B8%8B%E8%BD%BD%E8%BD%AF%E4%BB%B6%E5%8C%85)    获取平台对应的软件包，建议选择yasdb-  *版本号*  -py3-none-any.whl。

2.将压缩包下载到本地路径，如/path/YASDB Python。

3.进行安装。

```
pip3 install yasdb-1.0.2-py3-none-any.whl
```

  `  
`  

### 2、使用

####   [连接数据库](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E8%BF%9E%E6%8E%A5%E6%95%B0%E6%8D%AE%E5%BA%93)  

通过python-yasdb模块提供的connect函数建立数据库连接，并返回一个连接对象（Connection）。

可使用方法如下：

```
# 使用dsn、user、password参数
conn = yasdb.connect(dsn=self.getDsn(), user=self.user, password=self.pwd)
# 使用dsn参数
conn = yasdb.connect(self.user+"/"+self.pwd+"@"+self.getDsn())
# 使用dsn、password参数
conn = yasdb.connect(self.user+"@"+self.getDsn(), password=self.pwd)
# 使用host、port、user、password参数
conn = yasdb.connect(host=self.host, port=self.port, user=self.user, password=self.pwd)
```

####   [执行SQL](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E6%89%A7%E8%A1%8Csql)  

调用Connection的cursor()方法创建并返回一个游标对象（Cursor），该游标对象可用于执行语句和获取结果。

```
cursor =connection.cursor()
```

####   [执行SQL语句](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E6%89%A7%E8%A1%8Csql%E8%AF%AD%E5%8F%A5)  

调用Cursor的execute()方法执行SQL语句，并通过commit()方法将挂起的事务提交到数据库。

```
cursor.execute("drop table if exists example_table")
cursor.execute("create table example_table(id int , num int)")
cursor.execute("insert into example_table values(1,'test1')")
connection.commit()
```

####   [执行带参数的SQL语句](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E6%89%A7%E8%A1%8C%E5%B8%A6%E5%8F%82%E6%95%B0%E7%9A%84sql%E8%AF%AD%E5%8F%A5)  

```
cursor.execute("insert into example_table values(?,?)",(2,'test2'))
data=(3,'test3')
cursor.execute("insert into example_table values(?,?)",data)
connection.commit()
```

####   [关闭游标对象](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%85%B3%E9%97%AD%E6%B8%B8%E6%A0%87%E5%AF%B9%E8%B1%A1)  

调用Cursor的close()方法后，该游标将不再可用。

```
cursor.close()
```

####   [关闭数据库连接](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%85%B3%E9%97%AD%E6%95%B0%E6%8D%AE%E5%BA%93%E8%BF%9E%E6%8E%A5)  

调用Connection的close()方法后，该连接将不再可用。

```
connection.close()
```

##   [示例](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E7%A4%BA%E4%BE%8B)  

```
import yasdb
# 连接数据库
connection=yasdb.connect(
	dsn='127.0.0.1:1688',
	user='sales',
	password='sales',
)
# 创建游标对象
cursor =connection.cursor()
# 执行SQL语句
cursor.execute("drop table if exists example_table")
cursor.execute("create table example_table(id int , name varchar(32))")
cursor.execute("insert into example_table values(1,'test1')")
connection.commit()
cursor.execute("insert into example_table values(?,?)",(2,'test2'))
data=(3,'test3')
cursor.execute("insert into example_table values(?,?)",data)
connection.commit()
# 关闭游标对象
cursor.close()
# 关闭数据库连接
connection.close()
```

# 二、实现

### 1、结构

![](https://pingcode.yasdb.com/atlas/files/public/67396d3da1ad9a3311dc8fc3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBaUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY4NDgsImV4cCI6MTc4MjMxNzY0OH0.BF0-X5O2giBrc3zwLc6mQjaY6hSk_si67kUXlosIUpw)

libs中，yacli.py为C驱动库，exceptions.py为报错信息。

commons.py中为一些通用方法。

connection.py中为连接相关的类和方法。

cursor.py中为游标相关的类和方法。

lob.py中为lob相关的类和方法。

rows.py中为行、列相关的类和方法。

types.py中为数据类型相关的类和方法。

### 2、接口

python-yasdb已实现的Python DB API接口与标准的Python DB API完全兼容，相关接口/方法的含义和使用说明请参考    [Python DB API协议](https://peps.python.org/pep-0249/)    。标准接口在下文标注为（  standard）。

####   [Connection连接对象](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#connection%E8%BF%9E%E6%8E%A5%E5%AF%B9%E8%B1%A1)  

为数据库连接对象，对应Python应用程序与数据库的实际连接，用于执行整个数据库层面上的操作。

由python-yasdb模块提供的connect函数创建。

#####   [构造函数](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B1%9E%E6%80%A7)  

```
def connect(
    dsn: str = None,
    user: str = None,
    password: str = None,
    *,
    host: str = None,
    port: int = 1688,
    autocommit: bool = False,
) -> YasdbConnection:
```

创建连接后返回连接对象（Connection）。

#####   [属性](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B1%9E%E6%80%A7)  

|属性|
|:---|
|autocommit|
|handler|


#####   [已支持的方法](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B7%B2%E6%94%AF%E6%8C%81%E7%9A%84%E6%96%B9%E6%B3%95)  

|方法|改成内部方法|
|:---|---|
|connect(self, dsn: str, username: str, password: str, autocommit: bool)|  
|
|disconnect(self)|  
|
|set_auto_commit(self)|1|
|set_env_charset(self):|1|
|close(self) (  standard)|  
|
|commit(self) (  standard)|  
|
|rollback(self) (  standard)|  
|
|cursor(self) (  standard)|  
|


####   [Cursor游标对象](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#cursor%E6%B8%B8%E6%A0%87%E5%AF%B9%E8%B1%A1)  

为数据库游标对象，用于管理对数据库中具体内容的操作，如执行SQL语句和获取语句执行结果。

该对象通过Connection的cursor()方法创建。

#####   [构造函数](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B1%9E%E6%80%A7)  

```
# 创建游标对象
cursor =connection.cursor()
```

#####   [属性](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B1%9E%E6%80%A7)  

|属性|
|:---|
|description   (  standard)|
|rowcount   (  standard)|
|handler|


#####   [已支持的方法](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B7%B2%E6%94%AF%E6%8C%81%E7%9A%84%E6%96%B9%E6%B3%95-1)  

|方法|  
|
|:---|---|
|close(self) (  standard)|  
|
|prepare(self, sql: str)|1|
|execute(    
   self,    
   sql: Union[str, None],    
   params: Union[list, tuple, dict] = None,    
   **keyword_parameters: Any,    
  ) (  standard)|  
|
|executemany(self, sql: str, multi_params=None) (  standard)|  
|
|fetchone(self) (  standard)|  
|
|bind_columns(self)|1|
|bind_index_parameters(self, params, keyword_parameters=None)|1|
|callproc(self, procname, params=None) (  standard)|  
|
|fetchall(self) (  standard)|  
|
|fetchmany(self, nums: int = None) (  standard)|  
|
|var(    
   self,    
   typ: any,    
   size: int = -1,    
   arraysize: int = 1,    
   inconverter: Callable = None,    
   outconverter: Callable = None,    
  )|  
|


####   [rows类型对象](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#connection%E8%BF%9E%E6%8E%A5%E5%AF%B9%E8%B1%A1)  

#####   [类](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B1%9E%E6%80%A7)  

|类|
|:---|
|YasColumnDesc|
|YasRow|
|YasColumn(YasRow)|
|YasParameter(YasRow)|


#####   [属性](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B1%9E%E6%80%A7)  

|属性 (YasRow)|
|:---|
|name   (standard)|
|null_ok|
|type_code   (standard)|
|display_size   (standard)|
|internal_size   (standard)|
|precision   (standard)|
|scale   (standard)|
|typ (YasParameter)|
|values (YasParameter)|


#####   [已支持的方法](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B7%B2%E6%94%AF%E6%8C%81%E7%9A%84%E6%96%B9%E6%B3%95-1)  

|YasRow方法|  
|
|:---|---|
|get_column_desc(  self)|1|


|YasColumn方法|  
|
|:---|---|
|bind_column(  self)|1|
|get_column_value(  self)|1|


|YasParameter方法|
|:---|
|getvalue(self)|
|free(self)|
|setvalue(self, value: any, free_with_conn=False)|
|set_output(self, typ: any, size: int = -1)|
|bind_index_parameter(self)|


####   [LOB类型对象](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B7%B2%E6%94%AF%E6%8C%81%E7%9A%84%E6%96%B9%E6%B3%95-1)  

#####   [属性](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B1%9E%E6%80%A7)  

|属性|  
|
|:---|---|
|locator|1|
|locator_ptr|1|
|handler|1|


#####   [已支持的方法](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B7%B2%E6%94%AF%E6%8C%81%E7%9A%84%E6%96%B9%E6%B3%95-1)  

|方法|  
|
|:---|---|
|alloc(self)|1|
|free(self)|  
|
|write(self, data: bytes)|  
|
|read(self)|  
|


####   [数据类型对象](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B7%B2%E6%94%AF%E6%8C%81%E7%9A%84%E6%96%B9%E6%B3%95-1)  

#####   [类](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B1%9E%E6%80%A7)  

|类|
|:---|
|YasType|
|BOOL(YasType)|
|BYTE(YasType)|
|SHORT(YasType)|
|INTEGER(YasType)|
|BIGINT(YasType)|
|FLOAT(YasType)|
|DOUBLE(YasType)|
|NUMBER(YasType)|
|DATE(YasType)|
|TIME(DATE)|
|DATETIME(DATE)|
|TIMEDELTA(DATE)|
|CHAR(YasType)|
|VARCHAR(CHAR)|
|NCHAR(CHAR)|
|NVARCHAR(CHAR)|
|BINARY(YasType)|
|BIT(BIGINT)|
|ROWID(CHAR)|
|JSON(CHAR)|
|NONE(CHAR)|
|YEARDELTA(CHAR)|
|BLOB(YasType)|
|CLOB(BLOB)|
|NCLOB(CLOB)|


#####   [属性](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B1%9E%E6%80%A7)  

|YasType属性|  
|
|:---|---|
|bind_ptr|1|
|bind_size|1|
|bind_type|1|


#####   [已支持的方法](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#%E5%B7%B2%E6%94%AF%E6%8C%81%E7%9A%84%E6%96%B9%E6%B3%95-1)  

|方法|  
|
|:---|---|
|get_value  (  self  )|1|
|set_value  (  self  , value=  None  , size=  None  )|1|
|is_lob  (  self  )|1|
|is_char  (  self  )|1|
|is_nchar  (  self  )|1|
|get_desc_size  (  self  , desc)|1|


YashanDB Python驱动会对YashanDB数据类型进行转换，转换关系如下：

|Python Type|YashanDB Type|
|:---|:---|
|bool|BOOL|
|int|BIGINT|
|float|DOUBLE|
|str|VARCHAR|
|bytes|BINARY|
|type(None)|NONE|
|datetime.datetime|DATETIME|
|datetime.date|DATE|
|datetime.timedelta|TIMEDELTA|
|datetime.time|TIME|
|decimal.Decimal|NUMBER|
|list|JSON|
|dict|JSON|


####   [Globals](https://conf.yasdb.com/pages/viewpage.action?pageId=163001598#globals)  

  [Python DB API协议](https://peps.python.org/pep-0249/)     v2.0规范中要求数据库模块都应该定义如下3个变量：

|名称|含义|取值|
|:---|:---|:---|
|apilevel|表示模块支持的DB API版本|2.0|
|threadsafety|模块接口支持的线程安全级别|2|
|paramstyle|参数标记(parameter marker)的格式化风格|named|


如上3个变量已在yasdb模块中定义，Python开发人员可通过如下代码查看变量的值：

```
>>> import yasdb
>>> yasdb.threadsafety
2
>>> yasdb.apilevel
'2.0'
>>> yasdb.paramstyle
'named'
```

## Attachments:

## Comments:

|  [](null)  ,标准里可选的方法补全,Posted by liuliangjie at 八月 15, 2024 17:40|
|---|
|  [](null)  ,threadsafety可能有问题,Posted by liuliangjie at 八月 15, 2024 17:43|
