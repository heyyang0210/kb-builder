Created by 文博浩, last modified on 七月 11, 2023

SR:    [YDBRD-13362](https://jira.yasdb.com/browse/YDBRD-13362?src=confmacro)    -  PCRE2从CPM迁移为PLUGIN  完成

##   [1. Overview（概述）](#1-overview概述)  

解pcre2库cpm依赖。plugin编译成一个动态库，这个动态库依赖cpm里的pcre2库。对外功能以function的方式体现。

##   [2. Features（功能特性）](#2-features功能特性)  

- regexp_count、regexp_instr、regexp_like、regexp_replace、regexp_substr函数，rlike filter规格与之前相同。
- 新增rlike_filter(a, b)函数，与a rlike b规格相同。
- 当PLUGIN发现依赖的PCRE对应DLL/SO不存在时，报错正则功能不支持。


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
static const YspiMember gRegMembers[] = {
    {.decl = "function REGEXP_COUNT(source_char string, pattern string, position int default 1, match_param string "
             "default 'c') return bigint",
     .method = regExpCount},
    {.decl = "function REGEXP_INSTR(source_char string, pattern string, position int default 1, occurrence int default "
             "1, return_opt int default 0, match_param string default 'c', subexpr int default 0) return bigint",
     .method = regExpInStr},
    {.decl = "function REGEXP_LIKE(source_char string, pattern string, match_param string default 'c') return boolean",
     .method = regExpLike},
    {.decl = "function REGEXP_REPLACE(source_char string, pattern string, replace string default NULL, position int "
             "default 1, occurrence int default 0, match_param string default 'c') return string",
     .method = regExpReplace},
    {.decl = "function REGEXP_SUBSTR(source_char string, pattern string, position int default 1, occurrence int "
             "default 1, match_param string default 'c', subexpr int default 0) return string",
     .method = regExpSubStr},
    // rlike
    {.decl = "function rlike_filter(source_char string, pattern string) return boolean", .method = rLike}
};

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [cpm依赖](#cpm依赖)  

- cpm.yml中仍然保留pcre2
- 去掉ani_inc.c中加载pcre2库
- 删除行存内置函数实现
- enum EnBuiltinFuncId、BuiltinMethod gBuiltinMethods[]中去掉正则函数
- 删除bif_string.c中Verify、Conclude、Exec
- 删除/src/plsql/context/anl_reglike.h
- 删除/src/plsql/context/anl_reglike.c
- 删除/src/infra/utils/ani_reglike.h
- 删除/src/infra/utils/ani_reglike.c
- 集群doRegMatch正则功能调用plugin接口
- 删除列存内置函数实现
- 保留/ext/transform/Cargo.toml中pcre2-sys依赖（给自测用例用）
- 删除/exp/transform/src/expression/regexp_count.rs
- 删除/exp/transform/src/expression/regexp_instr.rs
- 删除/exp/transform/src/expression/regexp_replace.rs
- 删除/exp/transform/src/expression/regexp_substr.rs
- 删除/exp/transform/src/expression/mod.rs中函数入口
- 保留列存filter实现
- 保留/exp/transform/src/expression/reg.rs
- 保留/exp/transform/src/expression/regexp_like.rs
- 保留/exp/transform/src/expression/mod.rs中filter入口


###   [plugin function](#plugin-function)  

在/src/plsql/plugin下新建regexp文件夹，包含CMakeLists.txt和pi_regexp、pi_pcre2源文件。与regexp文件夹同级新建anl_regexp.h文件，定义原先ani_reglike中的yspiRegFuncSet结构体和函数，替换掉AnlAttr、AnrCallbackSet、RegFuncSet里的RegFuncSet。

- CMakeLists.txt
- pi_regexp负责注册和实现regexp函数，verify和exec阶段合并。
- pi_pcre2具体实现调用pcre2库函数、把ani_reglike中的逻辑移过来。


```
set(PLUGIN_REGEXP_SRC
        pi_regexp.c
        pi_pcre2.c)

add_library(yspi_regexp SHARED ${PLUGIN_REGEXP_SRC})

if(CMAKE_SYSTEM_NAME MATCHES "Linux")
    target_link_libraries(yspi_regexp PUBLIC yspi_sdk ${PROJECT_SOURCE_DIR}/deps/lib/libpcre2-8.so)
    install(TARGETS yspi_regexp DESTINATION plug-in/package/linux)
else()
    target_link_libraries(yspi_regexp PUBLIC yspi_sdk ${PROJECT_SOURCE_DIR}/deps/lib/pcre2-8.lib)
    install(TARGETS yspi_regexp DESTINATION plug-in/package/windows)
endif()

target_include_directories(yspi_regexp PUBLIC ./)
target_include_directories(yspi_regexp PRIVATE ./ ../include ${PROJECT_SOURCE_DIR}/deps/include)

```

yspi.h中增加函数定义：获取yspiRegFuncSet指针、设置字符集。

plugin_sdk.c中增加从anchorbase取regexp需要的值的对应函数。

/src/plsql/plugin/CMakeLists.txt中增加    `add_subdirectory(regexp)`    。

dbr/package/plug-in/package/package.ini中增加    `PACKAGE2 = {library = yspi_regexp, name = /, schema = public}`    ，不加package名，以public./.fuction方式，直接调用。

在anl_plugin.c中实现调用pcre2库的接口。

```
CodResult piPcre2GetSyms(CodPointer handle, YspiRegFuncSet* yspiRegFuncSet)
{
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_compile"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegCompile));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_code_free"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegFree));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_match"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegMatch));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_substitute"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegReplace));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_match_data_create_from_pattern"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegMatchDataCreate));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_match_data_free"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegMatchDataFree));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_general_context_create"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegGeneralCtxCreate));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_compile_context_create"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegCompileCtxCreate));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_match_context_create"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegMatchCtxCreate));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_general_context_free"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegGeneralCtxFree));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_compile_context_free"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegCompileCtxFree));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_match_context_free"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegMatchCtxFree));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_get_ovector_pointer"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegGetOvector));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_get_ovector_count"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegGetOvectorCount));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_get_error_message"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegGetErrorMessage));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_get_startchar"),(CodPointer*)&amp;yspiRegFuncSet-&gt;piRegGetStartChar));
    COD_CALL(codDynamicLibGetSym(handle, PCRE2_SUFFIX("pcre2_pattern_info"), (CodPointer*)&amp;yspiRegFuncSet-&gt;piRegGetPatternInfo));
    yspiRegFuncSet-&gt;piRegMemMalloc = (YspiRegMemMalloc)LocalRegPush;
    yspiRegFuncSet-&gt;piRegMemFree = (YspiRegMemFree)LocalRegPop;

    return COD_SUCCESS;
}

```

####   [default值](#default值)  

由于函数不是以package形式调用，不通过plsql创建自定义函数，所以要实现函数缺省参数支持default值。

- default值挂在
- 在parseMethodArgs阶段增加parse default值。
- verify校验函数参数argCount改为与minArgCount、maxArgCount比较。
- 修改piGetArg，取值时取不到从defaul值中取。


```
typedef struct StPiArgument {
    CodText       name;
    DataType      dataType;
    YspiDirection direction;
    Expr*         defaultExpr;
} PiArgument;

```

```
static CodResult parseArgDefault(PluginMngr* mngr, LangText* exprText, Expr** expr)
{
    AnlHandler*     handler = mngr-&gt;handler;
    AnlStmt*        stmt;
    COD_CALL(anlGetNcrStmt(handler, &amp;stmt));

    AnlParser parser = {
        .stmt = stmt,
        .lexer = ANL_LEXER,
        .user = &amp;stmt-&gt;handler-&gt;kattr-&gt;currUser,
        .userId = stmt-&gt;handler-&gt;kattr-&gt;currUserId,
        .memory = mngr-&gt;memory,
        .context = NULL,
        .currDatasetId = COD_INVALID_ID32,
        .currCteCtxId = COD_INVALID_UINT32,
    };


    LangWord word;
    lexInitWordItems(NULL, NULL, &amp;word);
    lexInit(parser.lexer, &amp;exprText-&gt;value, &amp;gAnlTokenSet, ANL_VARENV-&gt;charset, NULL);
    parser.lexer-&gt;readMode = LREAD_MODE_FUNCTION;
    COD_CALL(parseExprUntil(&amp;parser, &amp;word, COD_FALSE, expr));

    AnlVerifier vrfr;
    anlInitVerifier(stmt, mngr-&gt;memory, &amp;vrfr);
    vrfr.scnrFlags |= (SCNR_FLAG_KCB_EXPR | SCNR_FLAG_DCLOAD);
    return verifyExpr(&amp;vrfr, (Expr*)*expr);
}

```

###   [行存](#行存)  

####   [函数](#函数)  

通过自定义函数走plugin调用pcre2库。

以regexp_like为例：

```
static YspiResult regExpLike(YspiHandle hExec)
{
    YspiValue value, source, pattern, param;
    if (yspiGetArg(hExec, 0, YSPI_STRING, &amp;source) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }
    if (source.isNull) {
        varAsNull(&amp;value, YSPI_BOOL);
        return yspiReturn(hExec, &amp;value, true);
    }
    if (yspiGetArg(hExec, 1, YSPI_STRING, &amp;pattern) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }
    if (pattern.isNull) {
        varAsNull(&amp;value, YSPI_BOOL);
        return yspiReturn(hExec, &amp;value, true);
    } else if (pattern.size &gt; YSPI_MAX_REG_PAT_LEN) {
        yspiSetError(hExec, "maximum number of regular expressions is 512");
        return YSPI_ERROR;
    }
    if (yspiGetArg(hExec, 2, YSPI_STRING, ¶m) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }

    YspiRegLikeAssist likeAssist = {.memAssist.piRegPush = yspiPush, .memAssist.hExec = hExec, .reg_option.value = 0};

    if (doExecRegParamExpr(hExec, ¶m, &amp;likeAssist.reg_option) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }
    yspiSetCharset(hExec, &amp;likeAssist.reg_option);

    YspiRegFuncSet* regFuncSet = yspiGetReg(hExec);
    YSPI_CALL(piExecRegExpLike(regFuncSet, &amp;source, &amp;pattern, &amp;likeAssist, &amp;value.vBool));

    value.type = YSPI_BOOL;
    value.isNull = false;
    YspiResult result = yspiReturn(hExec, &amp;value, true);
    return result;
}

YspiResult piExecRegExpLike(YspiRegFuncSet* piRegFuncSet, YspiValue* string, YspiValue* pattern,
                            YspiRegLikeAssist* likeAssist, bool* result)
{
    int32_t       rc;
    YspiRegAssist piRegAssist;

    piRegAssistInit(&amp;piRegAssist, piRegFuncSet, pattern, &amp;likeAssist-&gt;memAssist, 0, likeAssist-&gt;reg_option);

    YSPI_CALL(piRegPrepare(&amp;piRegAssist));

    rc = piRegFuncSet-&gt;piRegMatch(piRegAssist.re, string-&gt;vStr, string-&gt;size, 0, 0, piRegAssist.match_data,
                                  piRegAssist.mcontext);

    if (rc == PCRE2_ERROR_NOMATCH) {
        *result = false;
    } else if (rc &gt;= 0) {
        *result = true;
    } else {
        piRegSetErrorMessage(piRegFuncSet, rc, &amp;likeAssist-&gt;memAssist);
        return YSPI_ERROR;
    }

    piRegRelease(&amp;piRegAssist);
    return YSPI_SUCCESS;
}

```

####   [filter](#filter)  

流程不变，exec通过plugin中函数调用pcre2库。

在FilterNode中增加    `CodPointer pif`    。

修改verify、exec，rlike改为走自定义函数rlike_filter。

```
static CodResult verifyFilterRlike(AnlVerifier* vrfr, FilterNode* node)
{
    Expr* subExpr = node-&gt;cmp.left;
    Expr* patExpr = node-&gt;cmp.right;

    COD_CALL(verifyExpr(vrfr, node-&gt;cmp.left));
    COD_CALL(verifyExpr(vrfr, node-&gt;cmp.right));

    CodBool isNull = COD_FALSE;
    COD_CALL(verifyRegExpr(vrfr, subExpr, patExpr, &amp;isNull));
    if (isNull) {
        if (vrfr-&gt;scnrFlags &amp; SCNR_FLAG_CHECK_COND) {
            filterAsTrue(node);
        } else if (!(vrfr-&gt;scnrFlags &amp; SCNR_FLAG_BOOLEXPR)) {
            adjustFilterFalse(node);
        }
        vrfr-&gt;inclFlags = 0;
    }
    // find item name
    static const CodText user = COD_TEXT_DEF("PUBLIC");
    static const CodText pkg = COD_TEXT_DEF("/");
    static const CodText name = COD_TEXT_DEF("rlike_filter");
    PluginMngr* mngr = vrfr-&gt;stmt-&gt;handler-&gt;inst-&gt;pluginMngr;
    PiItem* item;
    if (!tryFindItem(mngr, &amp;user, &amp;pkg, &amp;name, &amp;item)) {
        return COD_ERROR;
    }
    // put item into filter node pif
    node-&gt;pif = item;

    return COD_SUCCESS;
}

static CodResult execFilterRlike(AnlStmt* stmt, FilterNode* node, FilterResult* filterResult)
{
    COD_CALL(execPluginFilter(stmt, node, filterResult));
    return COD_SUCCESS;
}

static CodResult execFilterNotRlike(AnlStmt* stmt, FilterNode* node, FilterResult* filterResult)
{
    COD_CALL(execPluginFilter(stmt, node, filterResult));
    *filterResult = execFilterNot(*filterResult);
    return COD_SUCCESS;
}

```

在anl_plugin.c中实现新的exec。

```
CodResult execPluginFilter(AnlStmt* stmt, FilterNode* node, FilterResult* filterResult)
{
    PiItem*          item = (PiItem*)node-&gt;pif;
    PiPackageMember* mb = (PiPackageMember*)item-&gt;entity;

    Variant   retValue;
    Expr*     subExpr = node-&gt;cmp.left;
    Expr*     patExpr = node-&gt;cmp.right;
    PiHandler handler = {
        .stmt = stmt,
        .funcSet = &amp;gPluginFuncSet,
        .retValue = &amp;retValue,
        .left = subExpr,
        .right = patExpr,
    };
    COD_CALL((CodResult)mb-&gt;func.method((YspiHandle*)&amp;handler));
    if (handler.retValue-&gt;isNull) {
        *filterResult = FR_NULL;
    } else {
        *filterResult = handler.retValue-&gt;vBool ? FR_TRUE : FR_FALSE;
    }
    return COD_SUCCESS;
}

```

走到plugin rLike函数。

```
static YspiResult rLike(YspiHandle hExec)
{
    YspiValue value, source, pattern;
    if (yspiGetExpr(hExec, 0, YSPI_STRING, &amp;source) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }
    if (source.isNull) {
        varAsNull(&amp;value, YSPI_BOOL);
        return yspiReturn(hExec, &amp;value, true);
    }
    if (yspiGetExpr(hExec, 1, YSPI_STRING, &amp;pattern) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }
    if (pattern.isNull) {
        varAsNull(&amp;value, YSPI_BOOL);
        return yspiReturn(hExec, &amp;value, true);
    } else if (pattern.size &gt; YSPI_MAX_REG_PAT_LEN) {
        yspiSetError(hExec, "maximum number of regular expressions is 512");
        return YSPI_ERROR;
    }

    YspiRegLikeAssist likeAssist = {.memAssist.piRegPush = yspiPush, .memAssist.hExec = hExec, .reg_option.value = 0};

    likeAssist.reg_option.soCaseIns = false;
    yspiSetCharset(hExec, &amp;likeAssist.reg_option);

    YspiRegFuncSet* regFuncSet = yspiGetReg(hExec);
    YSPI_CALL(piExecRegExpLike(regFuncSet, &amp;source, &amp;pattern, &amp;likeAssist, &amp;value.vBool));

    value.type = YSPI_BOOL;
    value.isNull = false;
    YspiResult result = yspiReturn(hExec, &amp;value, true);
    return result;
}

```

###   [列存](#列存)  

之前的方案是提供的pcre2回调函数接口不变，列存不用改就可以跑通，行存走plugin自定义函数，列存走内置函数。由于前置功能设置函数优先级没有实现，这个方案不可行。

现方案：

由于没有内置函数，所以函数走通用表达式，通用表达式放开plugin函数。

```
_ if func.is_udf() || func.is_plugin() =&gt; {
    context.plan_ctx.set_have_general_expr(true);
    let stmt = context.stmt();
    Ok(Box::new(GeneralExpr::try_new(
        stmt.clone(),
        func.node() as *const ExprNode as usize,
        arg_exprs,
    )?))
}

```

filter不变，通过回调函数走到pcre2库。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- Windows、Linux环境
- 行表、列表
- 正则匹配函数、rlike filter
- 在绑定参数中调用
- PLUGIN发现依赖的PCRE对应DLL/SO不存在时报错


##   [7.性能测试](#7性能测试)  

##   [8.资料设计章节](#8资料设计章节)  

新增rlike_filter函数说明。

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

## Comments:

|  [](null)  ,rlike filter不使用abs别名，改成rlike_filter()，新增rlike_filter函数。,Posted by wenbohao at 七月 10, 2023 14:40|
|---|
