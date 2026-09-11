Created by 方少奎, last modified on 二月 29, 2024

  


##   [1. 总述](#1-总述)  

IR链接：    [YDBRD-27180](https://jira.yasdb.com/browse/YDBRD-27180)  

SR链接：    [YDBRD-27893](https://jira.yasdb.com/browse/YDBRD-27893)  

###   [1.1 需求来源](#11-需求来源)  

为了让用户从Oracle无修改迁移到YaShanDB，YaShanDB-JDBC需要适配Oracle行为。

###   [1.2 调研文档](#12-调研文档)  

调研文档：    [适配调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=144138871)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|setBoolean|向服务端传递DataType.INTEGER类型。|是|是|
|功能|setNull|固定数据类型为DataType.UNKOWN。|是|是|
|功能|配置ProductName|通过URL连接设置参数ProductName，不带到服务端|是|是|


###   [1.4 数据字典](#14-数据字典)  

不涉及。

###   [1.5 开源依赖](#15-开源依赖)  

不涉及。

##   [2. 接口](#2-接口)  

- 对于用户使用varchar(1)类型保存boolean对象时，需要向服务端传递DataType.INTEGER类型。


|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|PreparedStatementImpl.setBoolean(int index, boolean x)|参数：<br/>int 参数绑定下标<br/>boolean 绑定值|绑定参数时，向服务端传递DataType.INTEGER|是|


- 调用参数绑定接口setNull时，固定数据类型为DataType.UNKOWN。


|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SimpleParameterList.setNull(int index, int oid)|参数：<br/>int 参数绑定下标<br/>int 绑定类型SQLType|绑定参数setNull时，向服务端传递DataType.UNKOWN|是|


- 添加参数product name配置。


|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|YasDatabaseMetaData.getDatabaseProductName()|返回值：String|返回产品名称，根据配置product name，默认返回YaShanDB|是|


##   [3. 规格与约束](#3-规格与约束)  

为了适配oracle行为，对于用户使用varchar(1)类型保存boolean对象时，需要向服务端传递DataType.INTEGER类型。

为了适配hibernate行为，调用参数绑定接口setNull时，固定数据类型为DataType.UNKOWN。

为了满足oracle迁移用户需求，添加参数product name配置。

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

###   [4.2 特性功能点2](#42-特性功能点2)  

###   [4.3 特性性能点1](#43-特性性能点1)  

###   [4.4 特性性能点2](#44-特性性能点2)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

当用户使用varchar(1)类型保存boolean对象时，需要向服务端传递DataType.INTEGER类型。用例如下：

```
    @Test
    public void testBoolean() throws SQLException {
        try (Connection connection = TestUtil.openDB();
             Statement statement = connection.createStatement()) {
            statement.execute("drop table if exists test_set_boolean_tab");
            statement.execute("create table test_set_boolean_tab(id int, flag varchar(1))");
            try (PreparedStatement p = connection.prepareStatement("insert into test_set_boolean_tab values(1, ?)")) {
                p.setBoolean(1, true);
                p.execute();
            }
            ResultSet resultSet = statement.executeQuery("select flag from test_set_boolean_tab");
            while (resultSet.next()) {
                assertTrue(resultSet.getBoolean(1));
            }
        }
    }

```

为了适配hibernate行为，调用参数绑定接口setNull时，固定数据类型为DataType.UNKOWN。用例如下：

```
    @Test
    public void testBinarySetNull() throws SQLException {
        try (Connection conn = TestUtil.openDB();
             Statement stmt = conn.createStatement()) {
            ((YasConnection)conn).setClientPrepare(true);
            stmt.executeUpdate("drop table if exists test_binary_set_null");
            stmt.executeUpdate("create table test_binary_set_null (id int, ff float)");
            String sql = "insert into test_binary_set_null (id, ff) values(?, ?)";
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setObject(1,null);
                pstmt.setNull(2, Types.VARBINARY);
                pstmt.executeUpdate();
            }
        }
    }

```

为了满足oracle迁移用户需求，添加参数product name配置。用例如下：

```
    @Test
    public void testProduceName() throws Exception {
        Driver driver = new com.yashandb.jdbc.Driver();
        Properties info = new Properties();
        info.put("user", TestUtil.getUser());
        info.put("password", TestUtil.getPassword());
        String url = TestUtil.getURL() + "&amp;productName=oracle";
        assertTrue(driver.acceptsURL(url));
        Connection connection = driver.connect(url,info);
        DatabaseMetaData data = connection.getMetaData();
        assertEquals("oracle", data.getDatabaseProductName());
    }

```

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。