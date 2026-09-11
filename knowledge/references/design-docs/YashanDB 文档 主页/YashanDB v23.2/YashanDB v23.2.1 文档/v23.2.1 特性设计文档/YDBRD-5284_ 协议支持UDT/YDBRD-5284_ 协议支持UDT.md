Created by 史鑫, last modified by  冯皓博 on 十月 24, 2024

|类型|  
|  
|
|---|---|---|
|Object,VArray,Nested Table|元数据|- 系统表ER
- DC
    - 缓存结构 
    - 失效/加载
        - 自身失效/多层依赖如何失效控制
|
||数据|  
|
||protocal|元数据：ackPrepare组织格式,数据：,- 普通类型
- 单次交互拿不完数据的类型： clob/blob/json/xml/(cursor?)
- 类型组合后，单列一个packet（128K）塞不下
,协议兼容,- 元数据
- 数据：由于本次是自测，为了降低影响范围，仅仅最高版本的JDBC+最高版本的server才有此逻辑
|


-   [](#YDBRD5284:协议支持UDT-)  
-   [系统表](#YDBRD5284:协议支持UDT-系统表)  
-   [数据](#YDBRD5284:协议支持UDT-数据)  
    -   [存储](#YDBRD5284:协议支持UDT-存储)  
    -   [sql层序列化（VM）](#YDBRD5284:协议支持UDT-sql层序列化（VM）)  
    -   [协议](#YDBRD5284:协议支持UDT-协议)  
        -   [序列化](#YDBRD5284:协议支持UDT-序列化)  
        -   [asLob](#YDBRD5284:协议支持UDT-asLob)  
        -   [haslob](#YDBRD5284:协议支持UDT-haslob)  
        -   [反序列化](#YDBRD5284:协议支持UDT-反序列化)  
        -   [协议兼容](#YDBRD5284:协议支持UDT-协议兼容)  


## 系统表

```

```

![](https://pingcode.yasdb.com/atlas/files/public/67396c36a1ad9a3311dc889a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFCQUFBQUFDRUFBQUlRQUFBQUNFQUFBQUFBQUFBQUFRQ0lBQ1FBQVJBQUFJQUFBQkFBQ0FBQUFBSUFBQUVBQUFBQUFnQUFBQUFBQUFBQWdDQUFBQUtBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUNBSUFBQ0FBQWlFQUFJQWlBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUVBQUVBQUFEQUJBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3MTQsImV4cCI6MTc4MjMxMDUxNH0.uov6rqtcfTVb7581VJ_vnu-U_yl72fuEQZrEyxjnk_o)

**DC:**

![](https://pingcode.yasdb.com/atlas/files/public/67396c36a1ad9a3311dc889b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFCQUFBQUFDRUFBQUlRQUFBQUNFQUFBQUFBQUFBQUFRQ0lBQ1FBQVJBQUFJQUFBQkFBQ0FBQUFBSUFBQUVBQUFBQUFnQUFBQUFBQUFBQWdDQUFBQUtBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUNBSUFBQ0FBQWlFQUFJQWlBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUVBQUVBQUFEQUJBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3MTQsImV4cCI6MTc4MjMxMDUxNH0.uov6rqtcfTVb7581VJ_vnu-U_yl72fuEQZrEyxjnk_o)

**（1）udt对象本身的信息**  ：

- **TOID$**  （type的oid与toid关系）
- **TYPE$**  （type的属性）  --
    - **ATTRIBUTE$**  （type属性的属性）
    - **PARAMETER$**  （type的方法的参数）
    - **METHOD$**  （type方法的属性）
    - **COLLECTION$**  （TABLE/VARRAY的属性）--
- **TYPEBODY$**  （type body本身及每个方法定义的source） --


**（2）表实例化的列属性：**

- **COLTYPE$ **  （table中object列的信息）
- **ATTRCOL$ **  （table中object列每一个属性的信息）


**（3）UDT嵌套**

- **DEPENDENCY$：oid的依赖关系，compile时触发DC更新**


**以下说明元数据记录的信息：**

CREATE TYPE EmployeeType AS OBJECT (emp_id int,emp_name VARCHAR2(100));

create table t11(aaaaa EmployeeType(1,'111'));

**COL$**  ：3列：EmployeeType 实例化后的2列 + t11的aaaaa 列

**COLTYPE$ ：aaaaa信息**

**ATTRCOL$ ：2列：aaaaa.emp_id  ; aaaaa.emp_name **

## **数据**

### **存储**

  


### **sql层序列化（VM）**

  


### **协议**

#### **序列化**

**array/object/table都是以下格式：**

**说明：**

**（1）toid+version：控制元数据/数据版本。其中version的信息获取流程如下：**

- **打开表DC时，通过**  **COLTYPE$加载列依赖的type的toid**
- **通过toid打开udt的dc**
- **将udt的dc的version信息挂在表DC的col上**
- **从AnkCourser上decode数据时，将表DC的col的version挂在variant上（vRecord或vArray）**
- **序列化时，从variant上获取version信息。**


**（2）array的limit信息去除，用不到。**

**（3）udt中嵌套的udt，走udt的格式；udt中嵌套 的 基础类型格式为size+data。**

![](https://pingcode.yasdb.com/atlas/files/public/67396c368970c2af4f520a2b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFCQUFBQUFDRUFBQUlRQUFBQUNFQUFBQUFBQUFBQUFRQ0lBQ1FBQVJBQUFJQUFBQkFBQ0FBQUFBSUFBQUVBQUFBQUFnQUFBQUFBQUFBQWdDQUFBQUtBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUNBSUFBQ0FBQWlFQUFJQWlBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUVBQUVBQUFEQUJBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3MTQsImV4cCI6MTc4MjMxMDUxNH0.uov6rqtcfTVb7581VJ_vnu-U_yl72fuEQZrEyxjnk_o)

格式说明：

- null：0xFF
    - 成员类型的开头一定是尺寸，此尺寸确定是否为null
- udtRowHead的type指的是，当前对象的类型，并不是子对象的类型，协议上的数据类型解耦sql（DataType）。如果是非抽象类型，则二进制序列化（直接size+data，反序列化时，非抽象类型，具体的类型从元数据拿）。具体如下：
    - CS_UDT_ROW_OBJECT --0
    - CS_UDT_ROW_ARRAY --1
    - CS_UDT_ROW_TABLE --2


lob相关数据（以templob为例）：

- C/S对应关系
    - 协议交互：  AnlLobLocator，只是C/S对应关系使用。具体的数据信息，不在此，在  LobCacheItem
    - 服务端缓存信息：  LobCacheItem，缓存在anlHandler上，通过  AnlLobLocator的cacheid可找到LobCacheItem，此数据中有实际的数据（VM）
- 服务端内部操作：（以客户端fetch为例）
    - VarLob   ：实际数据在varlob->TempLobCoupon->vm上。当需要跟客户端交互时，为让客户端能够拿到其元数据信息，需要做以下操作：
        - 在handler上创建一个LobCacheItem，其vm等信息，来自TempLobCoupon。
        - LobCacheItem的信息封装成  AnlLobLocator吐给客户端。
        - 客户端拿AnlLobLocator做后续交互


![](https://pingcode.yasdb.com/atlas/files/public/67396c378970c2af4f520a2c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFCQUFBQUFDRUFBQUlRQUFBQUNFQUFBQUFBQUFBQUFRQ0lBQ1FBQVJBQUFJQUFBQkFBQ0FBQUFBSUFBQUVBQUFBQUFnQUFBQUFBQUFBQWdDQUFBQUtBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUNBSUFBQ0FBQWlFQUFJQWlBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUVBQUVBQUFEQUJBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3MTQsImV4cCI6MTc4MjMxMDUxNH0.uov6rqtcfTVb7581VJ_vnu-U_yl72fuEQZrEyxjnk_o)

#### **asLob**

当udt嵌套多，数据量大，服务采用  **VarLob（VM）的形式临时缓存结果集的序列化信息**  ，当需要发送时，做以下操作：

- handler下创建一个LobCacheItem，将VarLob的信息（vm等信息）挂在LobCacheItem上
- 将LobCacheItem的id等信息封装成  AnlLobLocator。
- 发送格式为：prafetchLen+locatorLen+数据+AnlLobLocator。


遗留问题：

（1）让udtCol的逻辑里区分是lob还是udt本身。

（2）什么时候开启asLob。

（3）客户端要显式释放。

（4）如何很大，temlob多次交互，客户端需要很大的缓存，所有信息缓存完成后，客户端再做binding操作。

#### **haslob**

以t1表说明格式

```
create type udt_arr as table of clob;
/
create table t1(a udt_arr) NESTED TABLE a STORE AS cc;

insert into t1 values(udt_arr('a'));
```

![](https://pingcode.yasdb.com/atlas/files/public/67396c378970c2af4f520a2d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFCQUFBQUFDRUFBQUlRQUFBQUNFQUFBQUFBQUFBQUFRQ0lBQ1FBQVJBQUFJQUFBQkFBQ0FBQUFBSUFBQUVBQUFBQUFnQUFBQUFBQUFBQWdDQUFBQUtBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUNBSUFBQ0FBQWlFQUFJQWlBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUVBQUVBQUFEQUJBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3MTQsImV4cCI6MTc4MjMxMDUxNH0.uov6rqtcfTVb7581VJ_vnu-U_yl72fuEQZrEyxjnk_o)

**  
**

#### **反序列化**

![](https://pingcode.yasdb.com/atlas/files/public/67396c37a1ad9a3311dc889c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFCQUFBQUFDRUFBQUlRQUFBQUNFQUFBQUFBQUFBQUFRQ0lBQ1FBQVJBQUFJQUFBQkFBQ0FBQUFBSUFBQUVBQUFBQUFnQUFBQUFBQUFBQWdDQUFBQUtBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUNBSUFBQ0FBQWlFQUFJQWlBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUVBQUVBQUFEQUJBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3MTQsImV4cCI6MTc4MjMxMDUxNH0.uov6rqtcfTVb7581VJ_vnu-U_yl72fuEQZrEyxjnk_o)

支持udt类型绑定参数，插入。服务端反序列化，udt的格式参考序列化。细节点做以下说明：

- 传输形式：udt绑定的类型仍是udt本身，但是数据的传输形式有两种：tempLob和普通的bytes，说明如下
    - TMPLOB：如上图所示。
        - prepare
        - tmpLob的创建/udt数据lob写到服务端
        - 执行，执行时数据为anlLobLocator
    - bytes：
        - 数据在execute时发送，不通过templob提前发送数据。
- 反序列化
    - 内存：anlHandler-》PGA(appHeap)
    - 数据来源：lob来自vm，否则直接来自packet


![](https://pingcode.yasdb.com/atlas/files/public/67396c37a1ad9a3311dc889d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFCQUFBQUFDRUFBQUlRQUFBQUNFQUFBQUFBQUFBQUFRQ0lBQ1FBQVJBQUFJQUFBQkFBQ0FBQUFBSUFBQUVBQUFBQUFnQUFBQUFBQUFBQWdDQUFBQUtBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUNBSUFBQ0FBQWlFQUFJQWlBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUVBQUVBQUFEQUJBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3MTQsImV4cCI6MTc4MjMxMDUxNH0.uov6rqtcfTVb7581VJ_vnu-U_yl72fuEQZrEyxjnk_o)

#### 协议兼容

**兼容点：**

（1）元数据：

![](https://pingcode.yasdb.com/atlas/files/public/67396c378970c2af4f520a2e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFCQUFBQUFDRUFBQUlRQUFBQUNFQUFBQUFBQUFBQUFRQ0lBQ1FBQVJBQUFJQUFBQkFBQ0FBQUFBSUFBQUVBQUFBQUFnQUFBQUFBQUFBQWdDQUFBQUtBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUNBSUFBQ0FBQWlFQUFJQWlBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUVBQUVBQUFEQUJBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3MTQsImV4cCI6MTc4MjMxMDUxNH0.uov6rqtcfTVb7581VJ_vnu-U_yl72fuEQZrEyxjnk_o)

（2）数据：fetch/binding insert

**兼容方式：**  升级ConnVersions

|端|原来最大版本|现在最大版本|处理|
|---|---|---|---|
|服务端|CONN_VER_5|CONN_VER_6|（1）CONN_VER_6：走udt流程（元数据/序列化/反序列化）,（2）<CONN_VER_6：不走udt逻辑,因此只有最高版本的JDBC+Server才有udt协议逻辑。|
|JDBC|CONN_VER_5|CONN_VER_6||
|C/Python|CONN_VER_5|**CONN_VER_5**||


注：  此处仅仅升级ConnVersions，不做其他处理（Response保持原来的）。以  **CONN_VER_3升到**  **CONN_VER_4为例**

![](https://pingcode.yasdb.com/atlas/files/public/67396c378970c2af4f520a2f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFCQUFBQUFDRUFBQUlRQUFBQUNFQUFBQUFBQUFBQUFRQ0lBQ1FBQVJBQUFJQUFBQkFBQ0FBQUFBSUFBQUVBQUFBQUFnQUFBQUFBQUFBQWdDQUFBQUtBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUNBSUFBQ0FBQWlFQUFJQWlBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUVBQUVBQUFEQUJBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3MTQsImV4cCI6MTc4MjMxMDUxNH0.uov6rqtcfTVb7581VJ_vnu-U_yl72fuEQZrEyxjnk_o)

  


  


## Attachments:

[image2024-1-2_17-57-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzU4OTcwYzJhZjRmNTIwYTEzIiwicmVmX2lkIjoiNjczOTZjMzQ1OTNmOTljOWZmMjM2YmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NzEzLCJleHAiOjE3ODIzODYxMTN9.67XWfxb-gno2oWgNSXQjIxuXCjPA9vnYjNQbnjZyThw)

 (image/png)    


[image2024-1-4_16-9-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzVhMWFkOWEzMzExZGM4ODg0IiwicmVmX2lkIjoiNjczOTZjMzQ1OTNmOTljOWZmMjM2YmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NzEzLCJleHAiOjE3ODIzODYxMTN9.fO2G1b4G5PtBWX2-I5xj-VDOO6F9DhTkLviGpgrRvZo)

 (image/png)    


[image2024-1-5_22-7-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzU4OTcwYzJhZjRmNTIwYTE3IiwicmVmX2lkIjoiNjczOTZjMzQ1OTNmOTljOWZmMjM2YmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NzEzLCJleHAiOjE3ODIzODYxMTN9.2wiSxmTWZ0pF51OR2btleRjJzDT2QpJhpCKkHFPHcK8)

 (image/png)    


[image2024-1-5_22-55-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzU4OTcwYzJhZjRmNTIwYTE4IiwicmVmX2lkIjoiNjczOTZjMzQ1OTNmOTljOWZmMjM2YmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NzEzLCJleHAiOjE3ODIzODYxMTN9.V2-sg9yqvpaOKYAtmneTrxMeE2ZIxxieaY9cU2p_iBY)

 (image/png)    


[image2024-1-8_19-5-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzVhMWFkOWEzMzExZGM4ODg5IiwicmVmX2lkIjoiNjczOTZjMzQ1OTNmOTljOWZmMjM2YmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NzEzLCJleHAiOjE3ODIzODYxMTN9.OPVDHTXIB4vbUsg0YPnyinDuzc09d53o2_-t0TarsnU)

 (image/png)    


[image2024-1-9_15-3-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzU4OTcwYzJhZjRmNTIwYTFhIiwicmVmX2lkIjoiNjczOTZjMzQ1OTNmOTljOWZmMjM2YmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NzEzLCJleHAiOjE3ODIzODYxMTN9.JFWY4pfDyo46vXfhXiG7nUBhWhtXugtfXaukOyTAFqg)

 (image/png)    


[image2024-1-15_11-21-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzVhMWFkOWEzMzExZGM4ODkwIiwicmVmX2lkIjoiNjczOTZjMzQ1OTNmOTljOWZmMjM2YmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NzEzLCJleHAiOjE3ODIzODYxMTN9.rF7IYRSG_GGhHailgztqIU0W4_TLEftJfA1fLk5p3Ic)

 (image/png)    
