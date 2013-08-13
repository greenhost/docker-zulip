var composebox_typeahead = (function () {

//************************************
// AN IMPORTANT NOTE ABOUT TYPEAHEADS
//************************************
// They do not do any HTML escaping, at all.
// And your input to them is rendered as though it were HTML by
// the default highlighter.
//
// So if you are not using trusted input, you MUST use the a
// highlighter that escapes (i.e. one that calls
// typeahead_helper.highlight_with_escaping).

var exports = {};

function get_pm_recipients(query_string) {
    // Assumes email addresses don't have commas or semicolons in them
    return query_string.split(/\s*[,;]\s*/);
}

// Returns an array of private message recipients, removing empty elements.
// For example, "a,,b, " => ["a", "b"]
exports.get_cleaned_pm_recipients = function (query_string) {
    var recipients = get_pm_recipients(query_string);
    recipients = _.filter(recipients, function (elem) {
        return elem.match(/\S/);
    });
    return recipients;
};

function case_insensitive_find(term, array) {
    var lowered_term = term.toLowerCase();
    return _.filter(array, function (elt) {
        return elt.toLowerCase() === lowered_term;
    }).length !== 0;
}

var seen_topics = new Dict();

exports.add_topic = function (stream, topic) {
    if (! seen_topics.has(stream)) {
        seen_topics.set(stream, []);
    }
    if (! case_insensitive_find(topic, seen_topics.get(stream))) {
        seen_topics.get(stream).push(topic);
        seen_topics.get(stream).sort();
    }
};

exports.topics_seen_for = function (stream) {
    if (seen_topics.has(stream)) {
        return seen_topics.get(stream);
    }
    return [];
};

function get_last_recipient_in_pm(query_string) {
    var recipients = get_pm_recipients(query_string);
    return recipients[recipients.length-1];
}

function composebox_typeahead_highlighter(item) {
    return typeahead_helper.highlight_with_escaping(this.query, item);
}

function query_matches_person(query, person) {
    // Case-insensitive.
    query = query.toLowerCase();

    return ( person.email    .toLowerCase().indexOf(query) !== -1
         ||  person.full_name.toLowerCase().indexOf(query) !== -1);

}

function query_matches_emoji(query, emoji) {
    return (emoji.emoji_name.indexOf(query.toLowerCase()) !== -1);
}

// nextFocus is set on a keydown event to indicate where we should focus on keyup.
// We can't focus at the time of keydown because we need to wait for typeahead.
// And we can't compute where to focus at the time of keyup because only the keydown
// has reliable information about whether it was a tab or a shift+tab.
var nextFocus = false;

function handle_keydown(e) {
    var code = e.keyCode || e.which;

    if (code === 13 || (code === 9 && !e.shiftKey)) { // Enter key or tab key
        if (e.target.id === "stream" || e.target.id === "subject" || e.target.id === "private_message_recipient") {
            // For enter, prevent the form from submitting
            // For tab, prevent the focus from changing again
            e.preventDefault();
        }

        // In the new_message_content box, preventDefault() for tab but not for enter
        if (e.target.id === "new_message_content" && code !== 13) {
            e.preventDefault();
        }

        if (e.target.id === "stream") {
            nextFocus = "subject";
        } else if (e.target.id === "subject") {
            if (code === 13) {
                e.preventDefault();
            }
            nextFocus = "new_message_content";
        } else if (e.target.id === "private_message_recipient") {
            nextFocus = "new_message_content";
        } else if (e.target.id === "new_message_content") {
            if (code === 13) {
                nextFocus = false;
            } else {
                nextFocus = "compose-send-button";
            }
        } else {
            nextFocus = false;
        }

        // If no typeaheads are shown...
        if (!($("#subject").data().typeahead.shown ||
              $("#stream").data().typeahead.shown ||
              $("#private_message_recipient").data().typeahead.shown ||
              $("#new_message_content").data().typeahead.shown)) {

            // If no typeaheads are shown and the user is tabbing from the message content box,
            // then there's no need to wait and we can change the focus right away.
            // Without this code to change the focus right away, if the user presses enter
            // before they fully release the tab key, the tab will be lost.  Note that we don't
            // want to change focus right away in the private_message_recipient box since it
            // takes the typeaheads a little time to open after the user finishes typing, which
            // can lead to the focus moving without the autocomplete having a chance to happen.
            if ((page_params.domain === "zulip.com" && nextFocus === "compose-send-button") ||
                (page_params.domain !== "zulip.com" && nextFocus)) {
                ui.focus_on(nextFocus);
                nextFocus = false;
            }

            // Send the message on Ctrl/Cmd-Enter or if the user has configured enter to
            // send and the shift key is not pressed.
            if (e.target.id === "new_message_content" && code === 13 &&
                (e.metaKey || e.ctrlKey || (page_params.enter_sends && !e.shiftKey))
               ) {
                e.preventDefault();
                if ($("#compose-send-button").attr('disabled') !== "disabled") {
                    $("#compose-send-button").attr('disabled', 'disabled');
                    compose.finish();
                }
            }
        }
    }
}

function handle_keyup(e) {
    var code = e.keyCode || e.which;
    if (code === 13 || (code === 9 && !e.shiftKey)) { // Enter key or tab key
        if (nextFocus) {
            ui.focus_on(nextFocus);
            nextFocus = false;
        }
    }
}

// http://stackoverflow.com/questions/3380458/looking-for-a-better-workaround-to-chrome-select-on-focus-bug
function select_on_focus(field_id) {
    $("#" + field_id).focus(function (e) {
        $("#" + field_id).select().one('mouseup', function (e) {
            e.preventDefault();
        });
    });
}

exports.split_at_cursor = function (query) {
    var cursor = $('#new_message_content').caret().start;
    return [query.slice(0, cursor), query.slice(cursor)];
};

exports.initialize = function () {
    select_on_focus("stream");
    select_on_focus("subject");
    select_on_focus("private_message_recipient");

    // These handlers are at the "form" level so that they are called after typeahead
    $("form#send_message_form").keydown(handle_keydown);
    $("form#send_message_form").keyup(handle_keyup);

    $("#enter_sends").click(function () {
        var send_button = $("#compose-send-button");
        page_params.enter_sends = $("#enter_sends").is(":checked");
        if (page_params.enter_sends) {
            send_button.fadeOut();
        } else {
            send_button.fadeIn();
        }

        // Refocus in the content box so you can continue typing or
        // press Enter to send.
        $("#new_message_content").focus();

        return $.ajax({
            dataType: 'json',
            url: '/json/change_enter_sends',
            type: 'POST',
            data: {'enter_sends': page_params.enter_sends}
        });
    });
    $("#enter_sends").prop('checked', page_params.enter_sends);
    if (page_params.enter_sends) {
        $("#compose-send-button").hide();
    }

    // limit number of items so the list doesn't fall off the screen
    $( "#stream" ).typeahead({
        source: function (query, process) {
            return subs.subscribed_streams();
        },
        items: 3,
        highlighter: function (item) {
            var query = this.query;
            return typeahead_helper.highlight_query_in_phrase(query, item);
        },
        matcher: function (item) {
            // The matcher for "stream" is strictly prefix-based,
            // because we want to avoid mixing up streams.
            var q = this.query.trim().toLowerCase();
            return (item.toLowerCase().indexOf(q) === 0);
        }
    });

    $( "#subject" ).typeahead({
        source: function (query, process) {
            var stream_name = $("#stream").val();
            return exports.topics_seen_for(stream_name);
        },
        items: 3,
        highlighter: composebox_typeahead_highlighter,
        sorter: function (items) {
            var sorted = typeahead_helper.sorter(this.query, items, function (x){return x;});
            if (sorted.length > 0 && sorted.indexOf(this.query) === -1) {
                sorted.unshift(this.query);
            }
            return sorted;
        }
    });

    $( "#private_message_recipient" ).typeahead({
        source: page_params.people_list,
        items: 5,
        dropup: true,
        highlighter: function (item) {
            var query = get_last_recipient_in_pm(this.query);
            var item_formatted = typeahead_helper.render_person(item);
            return typeahead_helper.highlight_with_escaping(query, item_formatted);
        },
        matcher: function (item) {
            var current_recipient = get_last_recipient_in_pm(this.query);
            // If the name is only whitespace (does not contain any non-whitespace),
            // we're between typing names; don't autocomplete anything for us.
            if (! current_recipient.match(/\S/)) {
                return false;
            }

            return query_matches_person(current_recipient, item);
        },
        sorter: typeahead_helper.sort_recipientbox_typeahead,
        updater: function (item) {
            var previous_recipients = exports.get_cleaned_pm_recipients(this.query);
            previous_recipients.pop();
            previous_recipients = previous_recipients.join(", ");
            if (previous_recipients.length !== 0) {
                previous_recipients += ", ";
            }
            return previous_recipients + item.email + ", ";
        },
        stopAdvance: true // Do not advance to the next field on a tab or enter
    });

    $( "#new_message_content" ).typeahead({
        source: function (query, process) {
            var q = exports.split_at_cursor(query)[0];

            var strings = q.split(/[\s*(){}\[\]]/);
            if (strings.length < 1) {
                return false;
            }
            var current_token = strings[strings.length-1];

            // Only start the emoji autocompleter if : is directly after one
            // of the whitespace or punctuation chars we split on.
            if (current_token[0] === ':') {
                // We don't want to match non-emoji emoticons such
                // as :P or :-p
                // Also, if the user has only typed a colon and nothing after,
                // no need to match yet.
                if (/^:-?.?$/.test(current_token)) {
                    return false;
                }
                this.completing = 'emoji';
                this.token = current_token.substring(1);
                return emoji.emojis;
            }

            // Don't autocomplete more than this many characters.
            var max_chars = 30;
            var last_at = q.lastIndexOf('@');
            if (last_at === -1 || last_at < q.length-1 - max_chars) {
                return false;  // No '@', or too far back
            }

            // Only match if the @ follows a space, various punctuation,
            // or is at the beginning of the string.
            if (last_at > 0 && "\n\t \"'(){}[]".indexOf(q[last_at-1]) === -1) {
                return false;
            }

            current_token = q.substring(last_at + 1);
            if (current_token.length < 1 || current_token.lastIndexOf('*') !== -1) {
                return false;
            }

            this.completing = 'mention';
            this.token = current_token.substring(current_token.indexOf("@")+1);
            var all_item = {
                special_item_text: "all (Notify everyone)",
                email: "all",
                // Always sort above, under the assumption that names will
                // be longer and only contain "all" as a substring.
                pm_recipient_count: Infinity,
                full_name: "all"
            };
            return page_params.people_list.concat([all_item]);
        },
        items: 5,
        highlighter: function (item) {
            if (this.completing === 'emoji') {
                return "<img class='emoji' src='" + item.emoji_url + "' /> " + item.emoji_name;
            } else if (this.completing === 'mention') {
                var item_formatted = typeahead_helper.render_person(item);
                return typeahead_helper.highlight_with_escaping(this.token, item_formatted);
            }
        },
        dropup: true,
        matcher: function (item) {
            if (this.completing === 'emoji') {
                return query_matches_emoji(this.token, item);
            } else if (this.completing === 'mention') {
                return query_matches_person(this.token, item);
            }
        },
        sorter: function (matches) {
            if (this.completing === 'emoji') {
                return typeahead_helper.sort_emojis(matches, this.token);
            } else if (this.completing === 'mention') {
                return typeahead_helper.sort_recipients(matches, this.token);
            }
        },
        updater: function (item) {
            var pieces = exports.split_at_cursor(this.query);
            var beginning = pieces[0];
            var rest = pieces[1];

            if (this.completing === 'emoji') {
                //leading and trailing spaces are required for emoji, except if it begins a message.
                if (beginning.lastIndexOf(":") === 0 || beginning.charAt(beginning.lastIndexOf(":") - 1) === " ") {
                    beginning = beginning.replace(/:\S+$/, "") + ":" + item.emoji_name + ": ";
                } else {
                    beginning = beginning.replace(/:\S+$/, "") + " :" + item.emoji_name + ": ";
                }
            } else if (this.completing === 'mention') {
                beginning = (beginning.substring(0, beginning.length - this.token.length-1)
                        + '@**' + item.full_name + '** ');
            }

            // Keep the cursor after the newly inserted text, as Bootstrap will call textbox.change() to overwrite the text
            // in the textbox.
            setTimeout(function () {
                $('#new_message_content').caret(beginning.length, beginning.length);
            }, 0);
            return beginning + rest;
        },
        stopAdvance: true // Do not advance to the next field on a tab or enter
    });

    $( "#private_message_recipient" ).blur(function (event) {
        var val = $(this).val();
        var recipients = exports.get_cleaned_pm_recipients(val);
        $(this).val(recipients.join(", "));
    });
};

return exports;

}());
